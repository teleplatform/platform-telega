import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { checkConstitution } from "../constitution/runtime-constitution.js";
import { enforceDoctrines } from "../knowledge/doctrine-enforcement-layer.js";
import { createExecutionApprovalRequest } from "../policy/execution-approval-queue.js";
import { consumeRuntimeBudget } from "./runtime-budget-middleware.js";
import { maybeEscalateRuntimeIncident } from "./runtime-incident-auto-escalation-hook.js";
import { checkRuntimeDecisionPoint } from "./runtime-decision-point-registry.js";
import { checkRuntimeMode } from "./runtime-mode-enforcement-hook.js";

export type FederationActionKind =
  | "register_runtime"
  | "revoke_runtime"
  | "trust_negotiation"
  | "capability_exchange"
  | "external_execution"
  | "marketplace_register"
  | "treaty_create"
  | "treaty_revoke"
  | "economy_exchange";

export interface FederationActionGovernanceInput {
  kind: FederationActionKind;
  runtime_id?: string;
  treaty_id?: string;
  marketplace_item_id?: string;
  requested_by?: "manual" | "system" | "mission_control" | "agent";
  actor_id?: string;
  trace_id?: string;
  risk_hint?: "low" | "medium" | "high" | "critical";
}

export interface FederationActionGovernanceResult {
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

const RISK_MAP: Record<FederationActionKind, "low" | "medium" | "high" | "critical"> = {
  capability_exchange: "medium",
  marketplace_register: "medium",
  register_runtime: "high",
  trust_negotiation: "high",
  external_execution: "high",
  economy_exchange: "high",
  revoke_runtime: "critical",
  treaty_create: "critical",
  treaty_revoke: "critical",
};

function computePolicy(kind: FederationActionKind, risk: string): "passed" | "blocked" | "requires_approval" {
  if (risk === "critical") return "requires_approval";
  if (kind === "external_execution") return "requires_approval";
  if (kind === "register_runtime") return "requires_approval";
  if (kind === "trust_negotiation") return "requires_approval";
  if (kind === "economy_exchange" && risk === "high") return "requires_approval";
  return "passed";
}

let hookCounter = 0;

function mapRequester(r?: "manual" | "system" | "mission_control" | "agent"): "manual" | "system" | "mission_control" {
  if (r === "agent") return "system";
  return r || "system";
}

export async function checkFederationActionGovernance(
  input: FederationActionGovernanceInput,
): Promise<FederationActionGovernanceResult> {
  hookCounter++;
  const traceId = input.trace_id || hashTraceId(`fed_gov_${hookCounter}`, "federation_governance_hook_checked");
  const actor = input.actor_id || input.requested_by || "system";
  const riskLevel = input.risk_hint || RISK_MAP[input.kind] || "high";
  await checkRuntimeDecisionPoint({ kind: "federation_action", trace_id: traceId, actor_id: actor, context: { kind: input.kind } });
  const modeCheck = await checkRuntimeMode({
    mode: input.requested_by === "manual" ? "creator" : "public",
    action: "federation",
    risk: riskLevel,
    mutation: input.kind !== "capability_exchange",
    trace_id: traceId,
    actor_id: actor,
  });
  const constitutionCheck = checkConstitution(`federation_${input.kind}`, actor);
  const constitution: "passed" | "blocked" = constitutionCheck.allowed ? "passed" : "blocked";

  let doctrineBlocked = false;
  if (riskLevel === "high" || riskLevel === "critical") {
    const dr = await enforceDoctrines("federation");
    doctrineBlocked = dr.blocked;
  }
  const doctrine: "passed" | "blocked" = doctrineBlocked ? "blocked" : "passed";

  const policyResult = computePolicy(input.kind, riskLevel);
  const cost = riskLevel === "critical" ? 30 : riskLevel === "high" ? 15 : 5;
  const budgetCheck = await consumeRuntimeBudget({
    action: "federation_action",
    units: Math.max(1, Math.ceil(cost / 10)),
    trace_id: traceId,
    actor_id: actor,
    mode: input.requested_by === "manual" ? "creator" : "public",
  });
  const budget: "passed" | "warning" | "blocked" = budgetCheck.allowed ? "passed" : "blocked";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "federation_governance_hook_checked"),
    trace_id: traceId, job_id: "hooks",
    type: "federation_governance_hook_checked", timestamp: new Date().toISOString(),
    payload: {
      kind: input.kind, runtime_id: input.runtime_id, treaty_id: input.treaty_id,
      marketplace_item_id: input.marketplace_item_id, risk_level: riskLevel,
      constitution: constitutionCheck.allowed, doctrine_blocked: doctrineBlocked,
      policy: policyResult, budget_approved: budget === "passed", requested_by: actor,
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
    reason = `Doctrine enforcement blocked federation action`;
  } else if (budget === "blocked") {
    decision = "blocked";
    reason = `Federation budget exhausted: ${budgetCheck.reason}`;
  } else if (policyResult === "requires_approval") {
    const approval = await createExecutionApprovalRequest({
      job_id: input.trace_id, trace_id: traceId,
      task_kind: `federation_${input.kind}`,
      target: input.runtime_id || input.treaty_id || input.marketplace_item_id,
      requested_by: mapRequester(input.requested_by),
      reason: `Federation ${input.kind} risk ${riskLevel}`,
    });
    approval_id = approval.approval_id;
    decision = "requires_approval";
    reason = `Approval required (risk: ${riskLevel}). Approval ID: ${approval_id}`;
  } else {
    decision = "allowed";
    reason = "All checks passed";
  }

  const evidenceType = decision === "allowed" ? "federation_governance_hook_allowed"
    : decision === "blocked" ? "federation_governance_hook_blocked"
    : "federation_governance_hook_approval_required";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, evidenceType),
    trace_id: traceId, job_id: "hooks",
    type: evidenceType, timestamp: new Date().toISOString(),
    payload: {
      kind: input.kind, runtime_id: input.runtime_id, treaty_id: input.treaty_id,
      risk_level: riskLevel, decision, constitution: constitutionCheck.allowed,
      doctrine_blocked: doctrineBlocked, policy: policyResult,
      budget_approved: budget === "passed", approval_id, requested_by: actor,
    },
  });

  if (decision === "blocked") {
    await maybeEscalateRuntimeIncident({
      kind: budget === "blocked" ? "budget_exhausted" : "federation_failure",
      title: "Federation governance blocked action",
      description: reason,
      trace_id: traceId,
      affected: ["federation", input.kind],
      severity_hint: riskLevel === "critical" ? "critical" : "high",
    });
  }

  return {
    decision, reason, risk_level: riskLevel,
    checks: { constitution, doctrine, policy: policyResult, budget },
    approval_id,
  };
}
