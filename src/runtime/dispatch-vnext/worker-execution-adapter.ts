// PD-W3/B3-B — Worker execution adapter. Internal/dormant-safe integration:
// Dispatch owns the canonical execution lifecycle, identity/capability recheck
// and safe executor hand-off; the Worker domain owns registry, liveness,
// capability matching, worker assignment (assignNodeToWorker) and the
// findBestWorker selection primitive, plus reassignment/degradation,
// federation/HMAC transport and worker metrics/evidence.
//
// Dispatch MUST NOT:
//   - call selectWorker                  (deferred dormant policy surface)
//   - score workers                      (Worker domain truth)
//   - choose replacement workers         (reassignment stays in Worker domain)
//   - implement worker retry/reassignment
//   - instantiate WorkerRuntime
//   - enable Worker Mode                 (mode stays 'direct')
//
// Canonical authority of Worker domain is the `worker-assignment` belt:
//   assignNodeToWorker → findBestWorker → WorkerAssignment → tracking/evidence.
// The adapter calls assignNodeToWorker directly; findBestWorker remains an
// internal primitive selection within that belt. Worker mode stays dormant —
// this adapter proves integration readiness, NOT production activation. See
// docs/PD-W3-B3-Forge-Worker-Execution-Migration-Gate.md.

import {
  buildCapabilityProfile,
  hasCapability as hasVNextCapability,
} from "../../core/authz/profiles.js";
import { resolveActor } from "../../core/authz/actor.js";
import { resolveActorMode } from "../../core/authz/modes.js";
import { assignNodeToWorker, updateAssignmentStatus } from "../workers/worker-assignment.js";
import type { RuntimeWorker, WorkerAssignment } from "../workers/worker-types.js";
import type { GraphNode, RuntimeCapability, TaskType } from "../sigma-forge/sigma-forge-types.js";
import type { ActionRouteKind } from "../routing/action-route.types.js";
import type {
  DispatchExecutionOutcome,
  DispatchExecutionContext,
} from "./dispatch-execution.types.js";
import type { DispatchExecutor } from "./dispatch-executor.js";
import type { DispatchPlan } from "./dispatch.types.js";

export const WORKER_RUNTIME_ROUTE: ActionRouteKind = "worker_runtime";

// Default gateway capability for Worker execution. Only internal/system
// vNext modes carry call_bridge_worker (see profiles CAPABILITIES_BY_MODE);
// public/api actors fail closed before any Worker selection or transport.
const WORKER_CAPABILITY = "call_bridge_worker";

// Worker domain transport boundary. The adapter performs the canonical
// assignment (assignNodeToWorker) itself; the port owns executing the worker
// transport (real/fake/local handler). Because Worker mode is dormant, the
// default port fails closed when no transport is wired.
export interface WorkerExecutionPort {
  execute(opts: {
    assignment: WorkerAssignment;
    worker: RuntimeWorker;
    node: GraphNode;
    input: Record<string, unknown>;
  }): Promise<WorkerResultLike>;
}

export interface WorkerResultLike {
  ok: boolean;
  output: unknown;
  evidence: string | null;
  durationMs: number;
  error: string | null;
}

interface WorkerCoercion {
  nodeId: string;
  taskType: TaskType;
  capability: RuntimeCapability;
  label: string;
  input: Record<string, unknown>;
}

// Read worker intent from the dispatch payload. Payload fields are coercion
// boundaries only — taskType/capability are validated against sanctioned
// Worker-domain TaskType values; nothing here is an authority, selection or
// scoring. Malformed input fails closed before assignment.
const SAFE_TASK_TYPES: readonly string[] = [
  "browser.navigate",
  "browser.click",
  "browser.type",
  "browser.extract",
  "browser.screenshot",
  "browser.wait",
  "browser.search",
  "browser.verify_condition",
  "memory.store",
  "memory.retrieve",
  "memory.search",
  "execution.shell",
  "execution.http",
  "execution.file_read",
  "execution.file_write",
  "execution.verify",
  "evidence.record",
  "evidence.verify",
  "evidence.export",
  "governance.check",
  "goals.create",
  "goals.update",
  "goals.complete",
  "artifact.register",
  "mission.summary",
];

const SAFE_CAPABILITIES: readonly string[] = [
  "browser",
  "memory",
  "execution",
  "evidence",
  "governance",
  "goals",
  "forge",
];

function readWorkerParams(payload?: Record<string, unknown>): WorkerCoercion {
  const nodeId = typeof payload?.nodeId === "string" ? payload.nodeId : "worker-node";
  const rawTask = payload?.taskType;
  const taskType: TaskType =
    typeof rawTask === "string" && (SAFE_TASK_TYPES as readonly string[]).includes(rawTask)
      ? (rawTask as TaskType)
      : "execution.shell";

  const rawCap = payload?.capability;
  const capability: RuntimeCapability =
    typeof rawCap === "string" && (SAFE_CAPABILITIES as readonly string[]).includes(rawCap)
      ? (rawCap as RuntimeCapability)
      : "execution";

  const label = typeof payload?.label === "string" ? payload.label : "worker execution";
  const input =
    typeof payload?.input === "object" && payload.input !== null
      ? (payload.input as Record<string, unknown>)
      : {};

  return { nodeId, taskType, capability, label, input };
}

function buildNode(p: WorkerCoercion, graphId: string): GraphNode {
  return {
    id: p.nodeId,
    taskType: p.taskType,
    capability: p.capability,
    label: p.label,
    params: p.input,
    phase: "worker",
    status: "ready",
    maxRetries: 0,
    retryCount: 0,
    output: null,
    error: null,
    checkpointId: null,
    traceId: null,
    evidenceRef: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    metadata: {},
  };
}

function failedOutcome<R>(
  plan: DispatchPlan,
  startedAt: string,
  message: string,
  code: string,
  target?: string,
): DispatchExecutionOutcome<R> {
  return {
    status: "failed",
    execution_id: plan.run_id,
    target,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    error: { message, failure_type: code },
  };
}

// PD-W3/B3-B — WorkerExecutionAdapter. Safe hand-off: the adapter never writes
// a second lifecycle (Dispatch coordinator owns dispatch_started→execution_started→
// execution_finished), never bypasses the worker-assignment belt, and preserves
// the WorkerAssignment/WorkerResult domain evidence in the dispatch outcome.
export class WorkerExecutionAdapter implements DispatchExecutor {
  readonly execution_route_kind: ActionRouteKind = WORKER_RUNTIME_ROUTE;

  constructor(private readonly transport: WorkerExecutionPort | null = null) {}

  async execute<R>(
    plan: DispatchPlan,
    context: DispatchExecutionContext,
  ): Promise<DispatchExecutionOutcome<R>> {
    const startedAt = new Date().toISOString();
    const subject = context.subject ?? plan.authorization.actor_id;
    const params = readWorkerParams(context.payload);

    // 1. Domain capability gate (call_bridge_worker) on top of dispatch authz.
    //    Public/api actors reach the executor but are denied here, fail-closed,
    //    before any Worker selection or transport call. No AuthZ broadening.
    const actor = resolveActor(subject);
    if (!actor) {
      return failedOutcome<R>(
        plan,
        startedAt,
        `worker domain policy denied execution for unresolvable subject ${subject}`,
        "worker_access_forbidden",
      );
    }
    const mode = resolveActorMode(actor);
    const profile = buildCapabilityProfile(actor.id, mode, actor.role);
    if (!hasVNextCapability(profile, WORKER_CAPABILITY)) {
      return failedOutcome<R>(
        plan,
        startedAt,
        `worker domain capability call_bridge_worker denied for subject ${subject} (mode=${mode})`,
        "worker_access_forbidden",
      );
    }

    // 2. No transport wired → honest fail-closed (Worker mode dormant). This
    //    proves integration readiness without production Worker activation.
    if (!this.transport) {
      return failedOutcome<R>(
        plan,
        startedAt,
        "worker transport not wired (Worker mode dormant, integration-ready only)",
        "WORKER_TRANSPORT_UNAVAILABLE",
      );
    }

    // 3. Canonical Worker-domain assignment entrypoint. The adapter calls
    //    assignNodeToWorker (belt: assignNodeToWorker → findBestWorker →
    //    WorkerAssignment). findBestWorker is never called directly; the
    //    selection primitive and any worker replacement remain Worker domain.
    //    If no worker is available the Worker domain reports it — Dispatch
    //    does not invent a target or pick a replacement.
    const node = buildNode(params, plan.run_id);
    const assignResult = assignNodeToWorker({
      graphId: plan.run_id,
      nodeId: node.id,
      taskType: node.taskType,
      capability: node.capability,
    });

    if ("error" in assignResult) {
      return failedOutcome<R>(
        plan,
        startedAt,
        assignResult.error,
        "WORKER_NO_AVAILABLE",
      );
    }

    const { assignment, worker } = assignResult;

    // 4. Invoke the existing committed worker execution path via the transport
    //    port. No second retry loop is implemented here; reassignment/recovery
    //    remains Worker-domain controlled and distinct from Dispatch replay.
    //    Assignment tracking (belt) is updated to the authoritative outcome.
    let result: WorkerResultLike;
    try {
      result = await this.transport.execute({
        assignment,
        worker,
        node,
        input: params.input,
      });
    } catch (e: any) {
      updateAssignmentStatus(assignment.id, "failed", {
        error: e?.message ?? "worker execution threw",
        completedAt: Date.now(),
        durationMs: Date.now() - new Date(startedAt).getTime(),
      });
      return failedOutcome<R>(
        plan,
        startedAt,
        e?.message ?? "worker execution threw",
        "WORKER_EXECUTION_ERROR",
        worker.id,
      );
    }

    if (!result.ok) {
      updateAssignmentStatus(assignment.id, "failed", {
        error: result.error ?? "worker execution failed",
        completedAt: Date.now(),
        durationMs: result.durationMs,
      });
      return failedOutcome<R>(
        plan,
        startedAt,
        result.error ?? "worker execution failed",
        "WORKER_EXECUTION_FAILED",
        worker.id,
      );
    }

    // Belt tracking: mark the WorkerAssignment completed with the transported
    // duration and evidence. This is Worker-domain tracking (not a second
    // Dispatch lifecycle) and keeps the canonical assignment authoritative.
    updateAssignmentStatus(assignment.id, "completed", {
      completedAt: Date.now(),
      durationMs: result.durationMs,
      evidenceRefs: result.evidence ? [result.evidence] : [],
    });

    // 5. Preserve the WorkerAssignment + WorkerResult domain evidence as
    //    dispatch output (workerId, assignmentId, evidence, outcome coexist
    //    with the canonical lifecycle — no duplicate lifecycle is written).
    return {
      status: "completed",
      execution_id: plan.run_id,
      target: worker.id,
      output_ref: assignment.id,
      output: {
        workerId: worker.id,
        workerName: worker.name,
        assignmentId: assignment.id,
        assignmentStatus: assignment.status,
        output: result.output,
        evidence: result.evidence,
        durationMs: result.durationMs,
      } as unknown as R,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };
  }
}
