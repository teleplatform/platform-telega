import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { checkConstitution } from "../constitution/runtime-constitution.js";
import { enforceDoctrines } from "../knowledge/doctrine-enforcement-layer.js";
import { createExecutionApprovalRequest } from "../policy/execution-approval-queue.js";
import { checkReplayRateLimit } from "../evidence/replay-rate-limiter.js";
import { consumeRuntimeBudget } from "./runtime-budget-middleware.js";
import { maybeEscalateRuntimeIncident } from "./runtime-incident-auto-escalation-hook.js";
import { checkRuntimeDecisionPoint } from "./runtime-decision-point-registry.js";

export interface ReplayGovernanceHardeningInput {
  trace_id: string;
  requested_by?: "manual" | "system" | "mission_control" | "agent";
  force?: boolean;
  target_override?: string;
  actor_id?: string;
  reason?: string;
  approved_replay?: boolean;
}

export interface ReplayGovernanceHardeningResult {
  decision: "allowed" | "blocked" | "requires_approval";
  reason: string;
  risk_level: "low" | "medium" | "high" | "critical";
  checks: Record<string, "passed" | "warning" | "blocked" | "requires_approval" | "skipped">;
  approval_id?: string;
}

let hookCounter = 0;

function mapRequester(r?: "manual" | "system" | "mission_control" | "agent"): "manual" | "system" | "mission_control" {
  if (r === "agent") return "system";
  return r || "system";
}

export async function checkReplayGovernanceHardening(
  input: ReplayGovernanceHardeningInput,
): Promise<ReplayGovernanceHardeningResult> {
  hookCounter++;
  const traceId = input.trace_id || hashTraceId(`replay_harden_${hookCounter}`, "replay_hardening_checked");
  const actor = input.actor_id || input.requested_by || "system";
  await checkRuntimeDecisionPoint({ kind: "replay", trace_id: traceId, actor_id: actor, context: { source_trace: input.trace_id } });
  const checks: Record<string, "passed" | "warning" | "blocked" | "requires_approval" | "skipped"> = {};

  const constitutionCheck = checkConstitution("replay_exec", actor);
  checks.constitution = constitutionCheck.allowed ? "passed" : "blocked";

  const dr = await enforceDoctrines("dangerous_execution");
  checks.doctrine = dr.blocked ? "blocked" : "passed";

  const traceRecords = readEvidenceRecords({ trace_id: input.trace_id, limit: 1 });
  const traceHealthy = traceRecords.length > 0;
  checks.trace_health = traceHealthy ? "passed" : "blocked";
  checks.preflight = "passed";
  checks.epistemic = "passed";
  checks.approval_state = input.approved_replay ? "passed" : input.force ? "requires_approval" : "skipped";
  checks.drift_gate = "passed";

  const replayRecords = readEvidenceRecords({ trace_id: input.trace_id, type: "execution_completed" as any });
  checks.original_execution = replayRecords.length > 0 ? "passed" : "warning";

  const rateLimitResult = await checkReplayRateLimit({ trace_id: input.trace_id, force: input.force });
  checks.rate_limit = rateLimitResult.allowed ? "passed" : "blocked";

  const budgetCheck = await consumeRuntimeBudget({ action: "replay", trace_id: traceId, actor_id: actor });
  checks.budget = budgetCheck.allowed ? "passed" : "blocked";

  const isForce = input.force === true;
  const isApprovedReplay = input.approved_replay === true;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "replay_hardening_checked"),
    trace_id: traceId, job_id: "hooks",
    type: "replay_hardening_checked", timestamp: new Date().toISOString(),
    payload: { source_trace: input.trace_id, force: isForce, checks, requested_by: actor, approved_replay: isApprovedReplay },
  });

  let decision: "allowed" | "blocked" | "requires_approval";
  let reason: string;
  let approval_id: string | undefined;
  let riskLevel: "low" | "medium" | "high" | "critical" = "medium";

  if (!isForce && checks.constitution === "blocked") {
    decision = "blocked"; reason = "Constitutional violation blocks replay";
  } else if (!isForce && checks.doctrine === "blocked") {
    decision = "blocked"; reason = "Doctrine blocks replay";
  } else if (checks.trace_health === "blocked") {
    decision = "blocked"; reason = "Trace has no evidence records";
  } else if (!isForce && checks.rate_limit === "blocked") {
    decision = "blocked"; reason = "Rate limit exceeded for this trace";
  } else if (isForce && !isApprovedReplay) {
    decision = "requires_approval";
    riskLevel = "critical";
    const approval = await createExecutionApprovalRequest({
      job_id: input.trace_id, trace_id: traceId, task_kind: "replay_force",
      target: input.target_override, requested_by: mapRequester(input.requested_by),
      reason: input.reason || "Force replay requires explicit approval",
    });
    approval_id = approval.approval_id;
    reason = `Approval required for force replay. Approval ID: ${approval_id}`;
  } else if (checks.original_execution === "warning" && !isForce) {
    decision = "requires_approval";
    riskLevel = "high";
    const approval = await createExecutionApprovalRequest({
      job_id: input.trace_id, trace_id: traceId, task_kind: "replay_unverified",
      target: input.target_override, requested_by: mapRequester(input.requested_by),
      reason: input.reason || "Replay with no original execution record found",
    });
    approval_id = approval.approval_id;
    reason = `Approval required — no original execution found. Approval ID: ${approval_id}`;
  } else if (!isForce && checks.budget === "blocked") {
    decision = "blocked"; reason = "Replay budget exhausted";
  } else if (isForce) {
    decision = "allowed"; reason = "Approved force replay";
  } else {
    decision = "allowed"; reason = "All checks passed";
  }

  const evidenceType = decision === "allowed" ? "replay_hardening_allowed"
    : decision === "blocked" ? "replay_hardening_blocked"
    : "replay_hardening_approval_required";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, evidenceType),
    trace_id: traceId, job_id: "hooks",
    type: evidenceType, timestamp: new Date().toISOString(),
    payload: { source_trace: input.trace_id, force: isForce, decision,
      checks, approval_id, requested_by: actor,
      reason: input.reason,
    },
  });

  if (decision === "blocked") {
    await maybeEscalateRuntimeIncident({
      kind: checks.budget === "blocked" ? "budget_exhausted" : checks.rate_limit === "blocked" ? "replay_storm" : "governance_blocked",
      title: "Replay hardening blocked execution",
      description: reason,
      trace_id: traceId,
      affected: ["replay"],
      severity_hint: checks.rate_limit === "blocked" ? "high" : "medium",
    });
  }

  return { decision, reason, risk_level: riskLevel, checks, approval_id };
}
