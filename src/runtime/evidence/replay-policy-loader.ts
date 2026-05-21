import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";

export interface ReplayPolicy {
  auto_approve: {
    manual: boolean;
    mission_control: boolean;
    system: boolean;
  };
  require_approval: {
    force: boolean;
    target_override: boolean;
    prior_replay: boolean;
    validation_failures_gt: number;
  };
  deny: {
    corrupt_trace: boolean;
    missing_task_snapshot: boolean;
    replay_loop: boolean;
    unknown_target: boolean;
  };
}

const POLICY_PATH = path.join(process.cwd(), ".sigma", "policies", "replay-policy.json");

const DEFAULT_POLICY: ReplayPolicy = {
  auto_approve: { manual: true, mission_control: true, system: false },
  require_approval: { force: true, target_override: true, prior_replay: true, validation_failures_gt: 1 },
  deny: { corrupt_trace: true, missing_task_snapshot: true, replay_loop: true, unknown_target: true },
};

let cachedPolicy: ReplayPolicy | null = null;

export function loadReplayPolicy(): ReplayPolicy {
  if (cachedPolicy) return cachedPolicy;

  if (!fs.existsSync(POLICY_PATH)) {
    cachedPolicy = { ...DEFAULT_POLICY };
    appendEvidenceRecord({
      evidence_id: hashTraceId("policy", "replay_policy_missing_default_used"),
      trace_id: "policy",
      job_id: "policy",
      type: "replay_policy_missing_default_used",
      timestamp: new Date().toISOString(),
      payload: { path: POLICY_PATH },
    }).catch(() => {});
    return cachedPolicy!;
  }

  try {
    const content = fs.readFileSync(POLICY_PATH, { encoding: "utf8" });
    const parsed = JSON.parse(content) as ReplayPolicy;
    cachedPolicy = parsed;

    appendEvidenceRecord({
      evidence_id: hashTraceId("policy", "replay_policy_loaded"),
      trace_id: "policy",
      job_id: "policy",
      type: "replay_policy_loaded",
      timestamp: new Date().toISOString(),
      payload: {
        auto_approve: parsed.auto_approve,
        require_approval: parsed.require_approval,
        deny: parsed.deny,
      },
    }).catch(() => {});

    return parsed;
  } catch {
    cachedPolicy = { ...DEFAULT_POLICY };
    return cachedPolicy;
  }
}

export function getReplayPolicyHash(): string {
  const policy = loadReplayPolicy();
  return hashTraceId(JSON.stringify(policy), "policy_hash").slice(0, 16);
}

export function clearReplayPolicyCache(): void {
  cachedPolicy = null;
}

export interface PolicyEvaluationInput {
  health: string;
  can_replay: boolean;
  requested_by: "manual" | "system" | "mission_control";
  force: boolean;
  target_override: unknown;
  failed_validation_count: number;
  prior_replays: number;
  has_task_snapshot: boolean;
  is_replay_result: boolean;
  target_is_safe: boolean;
  has_candidate: boolean;
}

export type PolicyDecision = "approved" | "denied" | "requires_approval";

export function evaluateReplayPolicy(input: PolicyEvaluationInput): {
  decision: PolicyDecision;
  reason: string;
} {
  const policy = loadReplayPolicy();

  if (input.is_replay_result && policy.deny.replay_loop && !input.force) {
    return { decision: "denied", reason: "replay_loop: trace is already a replay result" };
  }

  if (!input.target_is_safe && policy.deny.unknown_target) {
    return { decision: "denied", reason: "unknown_target: target_override not recognized" };
  }

  if (!input.has_candidate) {
    return { decision: "denied", reason: "no_replay_candidate" };
  }

  if (input.health === "corrupt" && policy.deny.corrupt_trace && !input.force) {
    return { decision: "denied", reason: "corrupt_trace: requires force override" };
  }

  if (!input.has_task_snapshot && policy.deny.missing_task_snapshot && !input.force) {
    return { decision: "denied", reason: "missing_task_snapshot: requires force override" };
  }

  const autoApproveEnabled =
    (input.requested_by === "manual" && policy.auto_approve.manual) ||
    (input.requested_by === "mission_control" && policy.auto_approve.mission_control) ||
    (input.requested_by === "system" && policy.auto_approve.system);

  if (
    autoApproveEnabled &&
    !input.force &&
    !input.target_override &&
    input.failed_validation_count <= policy.require_approval.validation_failures_gt &&
    input.prior_replays === 0 &&
    (input.health === "warning" || input.health === "failed")
  ) {
    return {
      decision: "approved",
      reason: "auto_approved: policy allows replay for this requester",
    };
  }

  const needsApproval =
    (policy.require_approval.force && input.force) ||
    (policy.require_approval.target_override && !!input.target_override) ||
    (policy.require_approval.prior_replay && input.prior_replays > 0) ||
    input.failed_validation_count > policy.require_approval.validation_failures_gt ||
    input.requested_by === "system";

  if (needsApproval) {
    const reasons: string[] = [];
    if (input.force) reasons.push("force_override");
    if (input.target_override) reasons.push("target_override");
    if (input.failed_validation_count > policy.require_approval.validation_failures_gt) {
      reasons.push(`validation_failed_x${input.failed_validation_count}`);
    }
    if (input.prior_replays > 0) reasons.push(`prior_replays:${input.prior_replays}`);
    if (input.requested_by === "system") reasons.push("system_request");
    return { decision: "requires_approval", reason: `requires_approval: ${reasons.join(", ")}` };
  }

  return { decision: "approved", reason: "approved: all policy checks passed" };
}
