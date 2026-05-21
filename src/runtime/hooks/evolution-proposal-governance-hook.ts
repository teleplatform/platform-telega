import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { checkConstitution } from "../constitution/runtime-constitution.js";
import { enforceDoctrines } from "../knowledge/doctrine-enforcement-layer.js";
import { checkCostGovernance } from "../economy/runtime-cost-governance.js";
import { createExecutionApprovalRequest } from "../policy/execution-approval-queue.js";
import { checkRuntimeMode } from "./runtime-mode-enforcement-hook.js";

export type EvolutionProposalKind =
  | "self_correction"
  | "evolution"
  | "doctrine_change"
  | "canon_promotion"
  | "policy_compilation"
  | "pack_generation"
  | "autonomous_plan";

export interface EvolutionProposalGovernanceInput {
  kind: EvolutionProposalKind;
  proposal_id?: string;
  source_trace_id?: string;
  requested_by?: "manual" | "system" | "mission_control" | "agent";
  actor_id?: string;
  trace_id?: string;
  risk_hint?: "low" | "medium" | "high" | "critical";
}

export interface EvolutionProposalGovernanceResult {
  decision: "allowed" | "blocked" | "requires_approval";
  reason: string;
  risk_level: "low" | "medium" | "high" | "critical";
  checks: {
    constitution: "passed" | "blocked";
    doctrine: "passed" | "blocked";
    policy: "passed" | "blocked" | "requires_approval";
    budget: "passed" | "warning" | "blocked";
  };
  approval_id?: string;
}

const POLICY_MAP: Record<EvolutionProposalKind, "requires_approval" | "passed" | "blocked"> = {
  self_correction: "requires_approval",
  evolution: "requires_approval",
  doctrine_change: "requires_approval",
  canon_promotion: "requires_approval",
  policy_compilation: "requires_approval",
  pack_generation: "requires_approval",
  autonomous_plan: "requires_approval",
};

const RISK_MAP: Record<EvolutionProposalKind, "low" | "medium" | "high" | "critical"> = {
  self_correction: "high",
  evolution: "critical",
  doctrine_change: "critical",
  canon_promotion: "high",
  policy_compilation: "high",
  pack_generation: "medium",
  autonomous_plan: "high",
};

let hookCounter = 0;

function mapRequester(r?: "manual" | "system" | "mission_control" | "agent"): "manual" | "system" | "mission_control" {
  if (r === "agent") return "system";
  return r || "system";
}

export async function checkEvolutionProposalGovernance(
  input: EvolutionProposalGovernanceInput,
): Promise<EvolutionProposalGovernanceResult> {
  hookCounter++;
  const traceId = input.trace_id || hashTraceId(`evol_gov_${hookCounter}`, "evolution_governance_hook_checked");
  const actor = input.actor_id || input.requested_by || "system";
  const riskLevel = input.risk_hint || RISK_MAP[input.kind] || "high";
  const modeCheck = await checkRuntimeMode({
    mode: input.requested_by === "manual" ? "creator" : "public",
    action: "evolution",
    risk: riskLevel,
    mutation: true,
    trace_id: traceId,
    actor_id: actor,
  });

  const constitutionCheck = checkConstitution(`evolution_${input.kind}`, actor);
  const constitution: "passed" | "blocked" = constitutionCheck.allowed ? "passed" : "blocked";

  const doctrineCtx = input.kind === "doctrine_change" ? "evolution" : "dangerous_execution";
  const dr = await enforceDoctrines(doctrineCtx as any);
  const doctrine: "passed" | "blocked" = dr.blocked ? "blocked" : "passed";

  const policyResult = POLICY_MAP[input.kind] || "requires_approval";
  const cost = riskLevel === "critical" ? 50 : riskLevel === "high" ? 20 : 10;
  const primaryBlocked = modeCheck.decision === "blocked" || constitution === "blocked" || doctrine === "blocked";
  const budgetCheck = primaryBlocked
    ? { approved: true, reason: "Skipped after primary governance block" }
    : await checkCostGovernance("planning", cost);
  const budget: "passed" | "warning" | "blocked" = budgetCheck.approved ? "passed" : "blocked";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "evolution_governance_hook_checked"),
    trace_id: traceId, job_id: "hooks",
    type: "evolution_governance_hook_checked", timestamp: new Date().toISOString(),
    payload: {
      kind: input.kind, proposal_id: input.proposal_id, source_trace_id: input.source_trace_id,
      risk_level: riskLevel, constitution: constitutionCheck.allowed,
      doctrine_blocked: dr.blocked, policy: policyResult,
      budget_approved: budget === "passed", requested_by: actor,
    },
  });

  let decision: "allowed" | "blocked" | "requires_approval";
  let reason: string;
  let approval_id: string | undefined;

  if (modeCheck.decision === "blocked") {
    decision = "blocked";
    reason = modeCheck.reason;
  } else if (constitution === "blocked") {
    decision = "blocked";
    reason = `Constitutional violation: ${constitutionCheck.violations.map((v) => v.rule_id).join(", ")}`;
  } else if (doctrine === "blocked") {
    decision = "blocked";
    reason = `Doctrine enforcement blocked: ${dr.violated_doctrines.map((d) => d.title).join(", ")}`;
  } else if (budget === "blocked") {
    decision = "blocked";
    reason = `Planning budget exhausted: ${budgetCheck.reason}`;
  } else if (policyResult === "requires_approval") {
    const approval = await createExecutionApprovalRequest({
      job_id: input.proposal_id, trace_id: traceId,
      task_kind: `evolution_${input.kind}`,
      requested_by: mapRequester(input.requested_by),
      reason: `Evolution ${input.kind} risk ${riskLevel}: proposal ${input.proposal_id || "unknown"}`,
    });
    approval_id = approval.approval_id;
    decision = "requires_approval";
    reason = `Approval required (risk: ${riskLevel}). Approval ID: ${approval_id}`;
  } else {
    decision = "allowed";
    reason = "All checks passed";
  }

  const evidenceType = decision === "allowed" ? "evolution_governance_hook_allowed"
    : decision === "blocked" ? "evolution_governance_hook_blocked"
    : "evolution_governance_hook_approval_required";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, evidenceType),
    trace_id: traceId, job_id: "hooks",
    type: evidenceType, timestamp: new Date().toISOString(),
    payload: {
      kind: input.kind, proposal_id: input.proposal_id,
      risk_level: riskLevel, decision, constitution: constitutionCheck.allowed,
      doctrine_blocked: dr.blocked, policy: policyResult,
      budget_approved: budget === "passed", approval_id, requested_by: actor,
    },
  });

  return {
    decision, reason, risk_level: riskLevel,
    checks: { constitution, doctrine, policy: policyResult, budget },
    approval_id,
  };
}
