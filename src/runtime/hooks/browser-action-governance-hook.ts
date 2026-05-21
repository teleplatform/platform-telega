import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { checkConstitution } from "../constitution/runtime-constitution.js";
import { enforceDoctrines } from "../knowledge/doctrine-enforcement-layer.js";
import { createExecutionApprovalRequest } from "../policy/execution-approval-queue.js";
import { consumeRuntimeBudget } from "./runtime-budget-middleware.js";
import { checkRuntimeDecisionPoint } from "./runtime-decision-point-registry.js";

export type BrowserActionKind =
  | "navigate"
  | "click"
  | "type"
  | "submit"
  | "upload"
  | "download"
  | "dom_read"
  | "dom_mutate"
  | "screenshot"
  | "clipboard_read"
  | "clipboard_write";

export interface BrowserActionGovernanceInput {
  kind: BrowserActionKind;
  url?: string;
  selector?: string;
  value_preview?: string;
  requested_by?: "manual" | "system" | "mission_control" | "agent";
  actor_id?: string;
  trace_id?: string;
  task_id?: string;
  risk_hint?: "low" | "medium" | "high" | "critical";
}

export interface BrowserActionGovernanceResult {
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

function isLocalOrInternalUrl(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith("/") || url.startsWith("#")) return true;
  try {
    const parsed = new URL(url);
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) || parsed.hostname.endsWith(".local");
  } catch {
    return false;
  }
}

function isExternalUrl(url?: string): boolean {
  if (!url) return false;
  return !isLocalOrInternalUrl(url);
}

function isPaymentOrDestructive(input: BrowserActionGovernanceInput): boolean {
  const haystack = [input.url, input.selector, input.value_preview].filter(Boolean).join(" ").toLowerCase();
  if (input.kind === "submit" && /\b(pay|payment|checkout|purchase|delete|destroy|account|session|token)\b/.test(haystack)) return true;
  if (input.kind === "click" && /\b(delete|destroy|remove|admin|pay|payment|checkout|mass|bulk)\b/.test(haystack)) return true;
  return false;
}

function classifyRisk(input: BrowserActionGovernanceInput): "low" | "medium" | "high" | "critical" {
  if (input.risk_hint) return input.risk_hint;
  if (isPaymentOrDestructive(input)) return "critical";
  if (input.kind === "navigate" && isExternalUrl(input.url)) return "high";
  if (input.kind === "submit" || input.kind === "upload" || input.kind === "clipboard_write" || input.kind === "dom_mutate") return "high";
  if (input.kind === "download" || input.kind === "click" || input.kind === "type") return "medium";
  return "low";
}

function computePolicy(kind: BrowserActionKind, risk: string): "passed" | "blocked" | "requires_approval" {
  if (risk === "critical") return "requires_approval";
  if (risk === "high") return "requires_approval";
  if (kind === "clipboard_read") return "requires_approval";
  if (kind === "dom_mutate") return "requires_approval";
  if (kind === "upload") return "requires_approval";
  return "passed";
}

let hookCounter = 0;

function mapRequester(r?: "manual" | "system" | "mission_control" | "agent"): "manual" | "system" | "mission_control" {
  if (r === "agent") return "system";
  return r || "system";
}

export async function checkBrowserActionGovernance(
  input: BrowserActionGovernanceInput,
): Promise<BrowserActionGovernanceResult> {
  hookCounter++;
  const traceId = input.trace_id || hashTraceId(`browser_gov_${hookCounter}`, "browser_governance_checked");
  const actor = input.actor_id || input.requested_by || "system";
  await checkRuntimeDecisionPoint({ kind: "browser_action", trace_id: traceId, actor_id: actor });
  const riskLevel = classifyRisk(input);
  const constitutionCheck = checkConstitution(`browser_${input.kind}`, actor);
  const constitution: "passed" | "blocked" = constitutionCheck.allowed ? "passed" : "blocked";

  let doctrineBlocked = false;
  if (riskLevel === "high" || riskLevel === "critical") {
    const dr = await enforceDoctrines("dangerous_execution");
    doctrineBlocked = dr.blocked;
  }
  const doctrine: "passed" | "blocked" = doctrineBlocked ? "blocked" : "passed";

  const policyResult = computePolicy(input.kind, riskLevel);
  const cost = riskLevel === "critical" ? 15 : riskLevel === "high" ? 8 : riskLevel === "medium" ? 3 : 1;
  const budgetCheck = await consumeRuntimeBudget({
    action: "browser_action",
    units: Math.max(1, Math.ceil(cost / 3)),
    trace_id: traceId,
    task_id: input.task_id,
    actor_id: actor,
  });
  const budget: "passed" | "warning" | "blocked" = budgetCheck.allowed ? "passed" : "blocked";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "browser_governance_checked"),
    trace_id: traceId,
    job_id: "hooks",
    type: "browser_governance_checked",
    timestamp: new Date().toISOString(),
    payload: {
      kind: input.kind, url: input.url?.slice(0, 200), selector: input.selector,
      risk_level: riskLevel, constitution: constitutionCheck.allowed,
      doctrine_blocked: doctrineBlocked, policy: policyResult,
      budget_approved: budget === "passed", requested_by: actor,
    },
  });

  let decision: "allowed" | "blocked" | "requires_approval";
  let reason: string;
  let approval_id: string | undefined;

  if (constitution === "blocked") {
    decision = "blocked";
    reason = `Constitutional violation: ${constitutionCheck.violations.map((v) => v.rule_id).join(", ")}`;
  } else if (doctrine === "blocked") {
    decision = "blocked";
    reason = "Doctrine enforcement blocked browser action";
  } else if (budget === "blocked") {
    decision = "blocked";
    reason = `Budget check failed: ${budgetCheck.reason || "insufficient budget"}`;
  } else if (policyResult === "requires_approval") {
    const approval = await createExecutionApprovalRequest({
      job_id: input.task_id,
      trace_id: traceId,
      task_kind: `browser_${input.kind}`,
      target: input.url || input.selector,
      requested_by: mapRequester(input.requested_by),
      reason: `Browser ${input.kind} risk ${riskLevel}` + (input.url ? `: ${input.url.slice(0, 200)}` : ""),
    });
    approval_id = approval.approval_id;
    decision = "requires_approval";
    reason = `Approval required (risk: ${riskLevel}). Approval ID: ${approval_id}`;
  } else {
    decision = "allowed";
    reason = "All checks passed";
  }

  const evidenceType = decision === "allowed" ? "browser_governance_allowed"
    : decision === "blocked" ? "browser_governance_blocked"
    : "browser_governance_approval_required";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, evidenceType),
    trace_id: traceId,
    job_id: "hooks",
    type: evidenceType,
    timestamp: new Date().toISOString(),
    payload: {
      kind: input.kind, url: input.url?.slice(0, 200), selector: input.selector,
      risk_level: riskLevel, decision, constitution: constitutionCheck.allowed,
      doctrine_blocked: doctrineBlocked, policy: policyResult,
      budget_approved: budget === "passed", approval_id, requested_by: actor,
    },
  });

  return {
    decision, reason, risk_level: riskLevel,
    checks: { constitution, doctrine, policy: policyResult, budget },
    approval_id,
  };
}
