import type {
  ActionEnvelope,
  ComplianceDecision,
  ComplianceReason,
  ApprovalRequest,
  ComplianceAuditEvent,
  ActionClass,
  SeverityLevel,
} from "../../runtime-compliance-contracts/src/compliance.js";
import { COMPLIANCE_REASONS } from "../../runtime-compliance-contracts/src/compliance.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";
import type { ComplianceRepos } from "../storage/sqlite/complianceRepo.js";

export interface ComplianceDeps {
  repos: ComplianceRepos;
}

export function createComplianceGateway(deps: ComplianceDeps) {
  const { repos } = deps;

  function classifyAction(action: ActionEnvelope): ActionClass {
    if (action.data_sensitivity === "critical" || action.side_effect_level === "high") {
      return "external_high_risk";
    }
    if (action.external_effect && (action.data_sensitivity === "sensitive" || action.user_visible_effect)) {
      return "external_medium_risk";
    }
    if (action.external_effect) {
      return "external_low_risk";
    }
    if (action.user_visible_effect) {
      return "user_visible_low_risk";
    }
    return "safe_internal";
  }

  function evaluatePolicy(action: ActionEnvelope, actionClass: ActionClass): {
    verdict: ComplianceDecision["verdict"];
    severity: SeverityLevel;
    requires_human_approval: boolean;
    approval_reason?: string;
    reason_codes: string[];
    policy_refs: string[];
  } {
    const reasons: string[] = [];
    const policyRefs: string[] = [];

    if (action.data_sensitivity === "critical") {
      reasons.push("SENSITIVE_DATA_EXPOSURE");
      return { verdict: "deny", severity: "critical", requires_human_approval: false, reason_codes: reasons, policy_refs: ["data_safety_policy"] };
    }

    if (action.action_type.includes("payment")) {
      reasons.push("PAYMENT_RELATED_ACTION");
      return { verdict: "require_approval", severity: "critical", requires_human_approval: true, approval_reason: "Payment related action requires approval", reason_codes: reasons, policy_refs: ["payment_policy"] };
    }

    if (action.side_effect_level === "high" && action.external_effect) {
      reasons.push("HIGH_RISK_EXTERNAL_WRITE");
      return { verdict: "escalate", severity: "high", requires_human_approval: true, approval_reason: "High risk external write", reason_codes: reasons, policy_refs: ["external_safety_policy"] };
    }

    if (action.side_effect_level === "high" && !action.external_effect) {
      reasons.push("IRREVERSIBLE_SIDE_EFFECT");
      return { verdict: "require_approval", severity: "high", requires_human_approval: true, approval_reason: "Irreversible side effect", reason_codes: reasons, policy_refs: ["safety_policy"] };
    }

    if (action.data_sensitivity === "sensitive" && action.external_effect) {
      reasons.push("SENSITIVE_DATA_EXPOSURE");
      return { verdict: "soft_block", severity: "high", requires_human_approval: false, reason_codes: reasons, policy_refs: ["data_safety_policy"] };
    }

    if (action.budget_impact === "high") {
      reasons.push("BUDGET_THRESHOLD_EXCEEDED");
      return { verdict: "require_approval", severity: "high", requires_human_approval: true, approval_reason: "High budget impact requires approval", reason_codes: reasons, policy_refs: ["budget_policy"] };
    }

    if (action.side_effect_level === "medium" && action.external_effect) {
      return { verdict: "allow_with_audit", severity: "medium", requires_human_approval: false, reason_codes: ["MEDIUM_EXTERNAL_EFFECT"], policy_refs: ["external_safety_policy"] };
    }

    return { verdict: "allow", severity: "low", requires_human_approval: false, reason_codes: [], policy_refs: ["default_policy"] };
  }

  function buildDecision(action: ActionEnvelope, actionClass: ActionClass, policyResult: ReturnType<typeof evaluatePolicy>): ComplianceDecision {
    return {
      decision_id: `comp_${randomUUID()}`,
      action_id: action.action_id,
      verdict: policyResult.verdict,
      severity: policyResult.severity,
      requires_human_approval: policyResult.requires_human_approval,
      approval_reason: policyResult.approval_reason,
      policy_refs: policyResult.policy_refs,
      reason_codes: policyResult.reason_codes,
      explanation: `Action classified as ${actionClass}, verdict: ${policyResult.verdict}`,
      decided_at: nowIso(),
    };
  }

  function createApprovalRequest(decision: ComplianceDecision, action: ActionEnvelope): ApprovalRequest | null {
    if (!decision.requires_human_approval) return null;
    return {
      request_id: `approval_${randomUUID()}`,
      action_id: action.action_id,
      mission_id: action.mission_id,
      required_decision: decision.verdict,
      recommended_option: decision.verdict === "escalate" ? "escalate" : "approve",
      status: "pending",
      opened_at: nowIso(),
    };
  }

  function auditDecision(decision: ComplianceDecision, action: ActionEnvelope): void {
    repos.audit.append({
      audit_id: `audit_${randomUUID()}`,
      action_id: action.action_id,
      mission_id: action.mission_id,
      event_type: "compliance_decision_made",
      actor_id: action.actor_id,
      details: {
        verdict: decision.verdict,
        severity: decision.severity,
        reason_codes: decision.reason_codes,
        requires_approval: decision.requires_human_approval,
      },
      timestamp: nowIso(),
    });
  }

  return {
    evaluateCompliance(action: ActionEnvelope): {
      decision: ComplianceDecision;
      approval_request: ApprovalRequest | null;
    } {
      const actionClass = classifyAction(action);
      const policyResult = evaluatePolicy(action, actionClass);
      const decision = buildDecision(action, actionClass, policyResult);

      repos.decisions.save(decision);

      const approvalRequest = createApprovalRequest(decision, action);
      if (approvalRequest) {
        repos.approvals.save(approvalRequest);
      }

      auditDecision(decision, action);

      return { decision, approval_request: approvalRequest };
    },

    classifyAction,
    evaluatePolicy,

    approveAction(action_id: string, approved_by: string): { approved: boolean; error?: string } {
      const decision = repos.decisions.getByActionId(action_id);
      if (!decision) {
        return { approved: false, error: "Decision not found for action" };
      }
      repos.audit.append({
        audit_id: `audit_${randomUUID()}`,
        action_id,
        event_type: "compliance_approved",
        actor_id: approved_by,
        details: { original_verdict: decision.verdict },
        timestamp: nowIso(),
      });
      return { approved: true };
    },

    rejectAction(action_id: string, rejected_by: string, reason: string): { rejected: boolean; error?: string } {
      const decision = repos.decisions.getByActionId(action_id);
      if (!decision) {
        return { rejected: false, error: "Decision not found for action" };
      }
      repos.audit.append({
        audit_id: `audit_${randomUUID()}`,
        action_id,
        event_type: "compliance_rejected",
        actor_id: rejected_by,
        details: { reason, original_verdict: decision.verdict },
        timestamp: nowIso(),
      });
      return { rejected: true };
    },
  };
}

export type ComplianceGateway = ReturnType<typeof createComplianceGateway>;
