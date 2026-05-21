import type { BuildTask } from "../../types/telecore.js";
import { createBuildTask } from "../../types/telecore.js";
import type { RuntimeTarget } from "../capability/capability.types.js";
import { dispatchBuildTask } from "../forge-bridge/job-dispatcher.js";
import { getEvidenceByTrace } from "./execution-evidence-store.js";
import { appendEvidenceRecord } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";
import { buildReplayCandidate } from "./replay-planner.js";
import { getTraceSummary } from "./trace-inspector.js";
import { createApprovalRequest } from "./replay-approval-queue.js";
import { recordReplayAttempt } from "./replay-rate-limiter.js";
import { linkReplayTraces } from "./trace-lineage.js";
import { checkRuntimePreflight } from "./runtime-preflight-gate.js";
import { checkReplayGovernanceHardening } from "../hooks/replay-governance-hardening-hook.js";

export interface ReplayExecutionOptions {
  requested_by?: "manual" | "system" | "mission_control";
  force?: boolean;
  target_override?: RuntimeTarget;
  preserve_input?: boolean;
  skip_validation?: boolean;
  skip_capability_negotiation?: boolean;
  reason?: string;
  approved_replay?: boolean;
}

export interface ReplayExecutionResult {
  original_trace_id: string;
  replay_trace_id?: string;
  original_job_id?: string;
  replay_job_id?: string;
  status: "started" | "blocked" | "failed";
  reason?: string;
  approval_id?: string;
}

export async function executeReplay(
  traceId: string,
  options?: ReplayExecutionOptions,
): Promise<ReplayExecutionResult> {
  const opts = options || {};
  const traceIdNew = hashTraceId(traceId, "replay");

  const gate = await checkReplayGovernanceHardening({
    trace_id: traceId,
    requested_by: opts.requested_by || "manual",
    force: opts.force,
    target_override: opts.target_override,
    actor_id: undefined,
    reason: opts.reason,
    approved_replay: opts.approved_replay,
  });
  if (gate.decision === "blocked") {
    return { original_trace_id: traceId, status: "blocked", reason: gate.reason };
  }
  if (gate.decision === "requires_approval") {
    return { original_trace_id: traceId, status: "blocked", reason: gate.reason, approval_id: gate.approval_id };
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "replay_requested"),
    trace_id: traceId,
    job_id: traceId,
    type: "replay_requested",
    timestamp: new Date().toISOString(),
    payload: {
      requested_by: opts.requested_by || "manual",
      force: opts.force || false,
      reason: opts.reason || "manual_request",
      replay_trace_id: traceIdNew,
    },
  });

  const preflight = await checkRuntimePreflight({
    trace_id: traceId,
    mode: "replay",
    requested_by: opts.requested_by || "manual",
    force: opts.force || false,
    target_override: opts.target_override,
    reason: opts.reason,
  });

  if (preflight.overall === "blocked") {
    const blockedCheck = preflight.checks.find((c) => c.status === "blocked");
    const preflightReason = blockedCheck?.message || "preflight blocked";
    return blockReplay(traceId, preflightReason);
  }

  if (preflight.approval_required && !opts.force) {
    const candidate = buildReplayCandidate(traceId);
    const approval = await createApprovalRequest({
      trace_id: traceId,
      requested_by: opts.requested_by || "manual",
      replay_reason: opts.reason || candidate?.replay_reason,
      target_override: opts.target_override,
      force: opts.force,
      governance_reason: preflight.governance?.reason || "requires approval",
    });

    await blockReplay(traceId, preflight.governance?.reason || "approval required");

    return {
      original_trace_id: traceId,
      status: "blocked",
      reason: `approval_required: ${preflight.governance?.reason || "requires approval"}`,
      approval_id: approval.approval_id,
    };
  }

  const summary = getTraceSummary(traceId);
  const records = getEvidenceByTrace(traceId);
  const candidate = buildReplayCandidate(traceId);

  const jobCreated = records.find((r) => r.type === "job_created");
  const taskSnapshot = jobCreated?.payload?.task_snapshot as BuildTask | undefined;

  if (!taskSnapshot && !opts.force) {
    return blockReplay(traceId, "missing_task_snapshot");
  }

  const originalJobId = summary?.job_id || traceId;
  const suggestedTarget = candidate?.suggested_runtime || "kilo_mcp";
  const targetOverride = opts.target_override || suggestedTarget;

  const replayTask: BuildTask = taskSnapshot
    ? {
        ...taskSnapshot,
        task_id: `replay_${traceIdNew}_${Date.now()}`,
        meta: {
          ...taskSnapshot.meta,
          created_at: Date.now(),
        },
        execution: taskSnapshot.execution
          ? {
              ...taskSnapshot.execution,
              target: targetOverride as any,
            }
          : undefined,
        context: {
          ...(taskSnapshot.context || {}),
          replay: {
            original_trace_id: traceId,
            original_job_id: originalJobId,
            replay_reason: opts.reason || candidate?.replay_reason,
            requested_by: opts.requested_by || "manual",
          },
        },
      }
    : createBuildTask({
        title: `replay: ${traceId}`,
        kind: "generic",
        target: targetOverride as any,
      });

  const replayJobId = replayTask.task_id;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceIdNew, "replay_started"),
    trace_id: traceIdNew,
    parent_trace_id: traceId,
    replay_of: traceId,
    job_id: replayJobId,
    type: "replay_started",
    timestamp: new Date().toISOString(),
    runtime_target: targetOverride,
    payload: {
      original_trace_id: traceId,
      original_job_id: originalJobId,
      requested_by: opts.requested_by || "manual",
      reason: opts.reason || candidate?.replay_reason,
      force: opts.force || false,
    },
  });

  try {
    const buildResult = await dispatchBuildTask(replayTask, traceId);

    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceIdNew, "replay_finished"),
      trace_id: traceIdNew,
      parent_trace_id: traceId,
      replay_of: traceId,
      job_id: replayJobId,
      type: "replay_finished",
      timestamp: new Date().toISOString(),
      runtime_target: targetOverride,
      lifecycle_state: buildResult.summary.status,
      output_hash: buildResult.execution?.trace_id
        ? hashTraceId(buildResult.execution.trace_id, "replay_output")
        : undefined,
      payload: {
        original_trace_id: traceId,
        status: buildResult.summary.status,
        duration_ms: buildResult.execution?.duration_ms,
      },
    });

    await recordReplayAttempt({ trace_id: traceId, force: opts.force || false });
    await linkReplayTraces(traceId, traceIdNew);

    return {
      original_trace_id: traceId,
      replay_trace_id: traceIdNew,
      original_job_id: originalJobId,
      replay_job_id: replayJobId,
      status: "started",
    };
  } catch (e: any) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceIdNew, "replay_finished"),
      trace_id: traceIdNew,
      parent_trace_id: traceId,
      replay_of: traceId,
      job_id: replayJobId,
      type: "replay_finished",
      timestamp: new Date().toISOString(),
      runtime_target: targetOverride,
      lifecycle_state: "failed",
      payload: {
        original_trace_id: traceId,
        error: e.message,
      },
    });

    return {
      original_trace_id: traceId,
      original_job_id: originalJobId,
      status: "failed",
      reason: e.message,
    };
  }
}

export async function executeReplayPlan(
  plan: { trace_id: string },
  options?: ReplayExecutionOptions,
): Promise<ReplayExecutionResult> {
  return executeReplay(plan.trace_id, options);
}

async function blockReplay(
  traceId: string,
  reason: string,
): Promise<ReplayExecutionResult> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "replay_blocked"),
    trace_id: traceId,
    job_id: traceId,
    type: "replay_blocked",
    timestamp: new Date().toISOString(),
    payload: { reason },
  });

  return {
    original_trace_id: traceId,
    status: "blocked",
    reason,
  };
}
