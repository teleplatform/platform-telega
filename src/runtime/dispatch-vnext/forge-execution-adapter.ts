// PD-W3/B3-A — Forge execution adapter. Safe execution hand-off: Dispatch owns
// the canonical execution lifecycle, identity recheck and availability recheck;
// the Forge domain owns scheduler/DAG/readiness, target selection and the real
// Forge execution. The adapter translates the canonical dispatch subject to the
// domain identity space (server-validated actor only — never payload forgery)
// and re-enforces the domain capability gate (forge_access) on top of dispatch
// authz. sigma_forge is NOT wired here — it stays deferred/fail-closed. See
// docs/PD-W3-B3-Forge-Worker-Execution-Migration-Gate.md.

import { getTargetStatus } from "../availability/availability-registry.js";
import type { RuntimeTarget } from "../availability/availability.types.js";
import { assertForgeBridgeAllowed } from "../forge-bridge/forge-bridge-policy.js";
import { runForgeTask } from "../forge-bridge/forge-bridge.js";
import type {
  ForgeExecutionTarget,
  ForgeResult,
  ForgeTaskKind,
} from "../forge-bridge/forge-bridge.types.js";
import type { ActionRouteKind } from "../routing/action-route.types.js";
import type {
  DispatchExecutionOutcome,
  DispatchExecutionContext,
} from "./dispatch-execution.types.js";
import type { DispatchExecutor } from "./dispatch-executor.js";
import type { DispatchPlan } from "./dispatch.types.js";

export const FORGE_BRIDGE_ROUTE: ActionRouteKind = "forge_bridge";

const SAFE_FORGE_KINDS: readonly ForgeTaskKind[] = [
  "create_file",
  "read_file",
  "update_file",
  "delete_file",
  "list_files",
  "run_code",
  "run_bridge_task",
  "verify_runtime",
  "open_project",
  "generic",
  "analyze_repo",
  "generate_patch",
  "execute_kilocode_task",
];

const TARGETS: readonly ForgeExecutionTarget[] = ["kilo_mcp", "forge_remote", "sigma_forge"];

// Forge domain identities are raw creator ids (runtime-access role model). The
// canonical dispatch subject is derived from a server-validated actor, so this
// extraction is a boundary translation of a trusted identity — never an actor
// taken from the request payload.
export function forgeDomainId(subject: string): string {
  const colonIdx = subject.indexOf(":");
  return colonIdx < 0 ? subject : subject.substring(colonIdx + 1);
}

export interface ForgeExecutionPort {
  run(params: {
    userId: string;
    kind: ForgeTaskKind;
    target: ForgeExecutionTarget;
    path?: string;
    input?: Record<string, unknown>;
  }): Promise<ForgeResult>;
}

export interface ForgeCoercionError {
  readonly code: string;
  readonly message: string;
  readonly target?: string;
}

function readForgeParams(payload?: Record<string, unknown>): {
  kind: ForgeTaskKind;
  target: ForgeExecutionTarget;
  path?: string;
  input: Record<string, unknown>;
} {
  const rawKind = payload?.kind;
  const kind: ForgeTaskKind =
    typeof rawKind === "string" && (SAFE_FORGE_KINDS as readonly string[]).includes(rawKind)
      ? (rawKind as ForgeTaskKind)
      : "run_bridge_task";

  const rawTarget = payload?.target;
  const target: ForgeExecutionTarget =
    typeof rawTarget === "string" && (TARGETS as readonly string[]).includes(rawTarget)
      ? (rawTarget as ForgeExecutionTarget)
      : "kilo_mcp";

  const path = typeof payload?.path === "string" ? payload.path : undefined;
  const input =
    typeof payload?.input === "object" && payload.input !== null
      ? (payload.input as Record<string, unknown>)
      : {};

  return { kind, target, path, input };
}

function failedOutcome<R>(
  plan: DispatchPlan,
  startedAt: string,
  error: ForgeCoercionError,
): DispatchExecutionOutcome<R> {
  return {
    status: "failed",
    execution_id: plan.run_id,
    target: error.target,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    error: { message: error.message, failure_type: error.code },
  };
}

// PD-W3/B3-A — ForgeExecutionAdapter. Safe hand-off: the adapter never writes a
// second lifecycle (Dispatch coordinator owns dispatch_started→execution_started→
// execution_finished), never invokes a legacy/pedestal executor in parallel, and
// preserves the full ForgeResult (domain DAG/task/artifact/verification evidence)
// in the dispatch outcome output.
export class ForgeExecutionAdapter implements DispatchExecutor {
  readonly execution_route_kind: ActionRouteKind = FORGE_BRIDGE_ROUTE;

  constructor(private readonly forge: ForgeExecutionPort = { run: runForgeTask }) {}

  async execute<R>(
    plan: DispatchPlan,
    context: DispatchExecutionContext,
  ): Promise<DispatchExecutionOutcome<R>> {
    const startedAt = new Date().toISOString();
    const { kind, target, path, input } = readForgeParams(context.payload);

    const subject = context.subject ?? plan.authorization.actor_id;
    const domainUserId = forgeDomainId(subject);

    // 1. Domain capability gate (forge_access) on top of dispatch authz. Public
    //    actors reach the executor but are denied here, fail-closed, before any
    //    transport call.
    try {
      assertForgeBridgeAllowed(domainUserId);
    } catch (e: any) {
      return failedOutcome<R>(plan, startedAt, {
        code: "forge_access_forbidden",
        message: `forge domain policy denied execution for subject ${subject}: ${e?.message ?? "forge_access_forbidden"}`,
        target,
      });
    }

    // 2. Availability recheck of the resolved domain target. Only "online"
    //    targets are executed; degraded (forge_http) and unprovisioned
    //    (sigma_forge) targets fail closed with an honest reason.
    const targetStatus = target === "unknown" ? undefined : getTargetStatus(target as RuntimeTarget);
    if (targetStatus !== "online") {
      return failedOutcome<R>(plan, startedAt, {
        code: targetStatus === undefined ? "FORGE_TARGET_UNAVAILABLE" : "FORGE_TARGET_DEGRADED",
        message: `forge domain target unavailable: ${target} (${targetStatus ?? "unprovisioned"})`,
        target,
      });
    }

    // 3. Real domain forge execution (ForgeBridge → router → adapter). No query
    //    parametrization beyond the sanctioned task shape; no legacy pathway.
    let forgeResult: ForgeResult;
    try {
      forgeResult = await this.forge.run({
        userId: domainUserId,
        kind,
        target,
        path,
        input: { ...input, prompt: (context.payload?.prompt as string) ?? "" },
      });
    } catch (e: any) {
      return failedOutcome<R>(plan, startedAt, {
        code: "FORGE_EXECUTION_ERROR",
        message: e?.message ?? "forge execution threw",
        target,
      });
    }

    if (forgeResult.status !== "done") {
      return failedOutcome<R>(plan, startedAt, {
        code: `forge_status_${forgeResult.status}`,
        message:
          forgeResult.diagnostics?.message ??
          forgeResult.summary ??
          `forge execution finished with status ${forgeResult.status}`,
        target: forgeResult.target,
      });
    }

    // 4. Preserve the full domain ForgeResult as dispatch output (domain
    //    evidence: target, taskId, artifacts, diagnostics coexist with the
    //    canonical lifecycle — no duplicate lifecycle is written here).
    return {
      status: "completed",
      execution_id: plan.run_id,
      target: forgeResult.target,
      provider_result_ref: undefined,
      output_ref: forgeResult.traceId,
      output: forgeResult as unknown as R,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };
  }
}