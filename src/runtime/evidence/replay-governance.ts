import type { RuntimeTarget } from "../capability/capability.types.js";
import { buildReplayCandidate } from "./replay-planner.js";
import { getTraceSummary, computeTraceHealth } from "./trace-inspector.js";
import { getEvidenceByTrace } from "./execution-evidence-store.js";
import { evaluateReplayPolicy, loadReplayPolicy } from "./replay-policy-loader.js";

export type ReplayDecision = "approved" | "denied" | "requires_approval";

export interface ReplayGovernanceInput {
  trace_id: string;
  requested_by: "manual" | "system" | "mission_control";
  force?: boolean;
  replay_reason?: string;
  target_override?: RuntimeTarget;
}

export interface ReplayGovernanceResult {
  decision: ReplayDecision;
  reason: string;
  requires_human: boolean;
  allowed_with_force: boolean;
}

export function evaluateReplayGovernance(
  input: ReplayGovernanceInput,
): ReplayGovernanceResult {
  const summary = getTraceSummary(input.trace_id);
  if (!summary) {
    return deny("trace_not_found", false);
  }

  const records = getEvidenceByTrace(input.trace_id);
  const { health } = computeTraceHealth(records);
  const candidate = buildReplayCandidate(input.trace_id);
  const jobCreated = records.find((r) => r.type === "job_created");
  const taskSnapshot = jobCreated?.payload?.task_snapshot;
  const isReplayResult = records.some((r) => r.replay_of !== undefined);
  const priorReplays = records.filter(
    (r) => r.type === "replay_started" || r.type === "replay_finished",
  ).length;
  const failedValidationCount = records.filter(
    (r) => r.type === "validation_gate_failed",
  ).length;
  const targetIsSafe =
    !input.target_override ||
    ["kilo_mcp", "forge_remote", "local_ollama"].includes(input.target_override);
  const force = input.force || false;

  loadReplayPolicy();
  const policyResult = evaluateReplayPolicy({
    health,
    can_replay: candidate?.can_replay || false,
    requested_by: input.requested_by,
    force,
    target_override: input.target_override,
    failed_validation_count: failedValidationCount,
    prior_replays: priorReplays,
    has_task_snapshot: !!taskSnapshot,
    is_replay_result: isReplayResult,
    target_is_safe: targetIsSafe,
    has_candidate: !!candidate,
  });

  return {
    decision: policyResult.decision,
    reason: policyResult.reason,
    requires_human: policyResult.decision === "requires_approval",
    allowed_with_force: force || policyResult.decision !== "denied",
  };
}

export function evaluateReplayGovernanceForced(
  input: ReplayGovernanceInput,
): ReplayGovernanceResult {
  const result = evaluateReplayGovernance(input);
  if (result.decision === "denied" && input.force) {
    return {
      decision: "requires_approval",
      reason: `requires_approval: denied overridden by force — ${result.reason}`,
      requires_human: true,
      allowed_with_force: true,
    };
  }
  return result;
}

function deny(reason: string, allowedWithForce: boolean): ReplayGovernanceResult {
  return {
    decision: "denied",
    reason: `denied: ${reason}`,
    requires_human: false,
    allowed_with_force: allowedWithForce,
  };
}
