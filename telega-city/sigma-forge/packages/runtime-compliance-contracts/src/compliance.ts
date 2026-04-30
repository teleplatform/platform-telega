export type ActionActorType = 'agent' | 'system' | 'human_assisted';
export type SideEffectLevel = 'none' | 'low' | 'medium' | 'high';
export type DataSensitivity = 'none' | 'internal' | 'sensitive' | 'critical';
export type BudgetImpact = 'none' | 'low' | 'medium' | 'high';
export type ComplianceVerdict = 'allow' | 'allow_with_audit' | 'require_approval' | 'soft_block' | 'deny' | 'escalate';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionClass = 'safe_internal' | 'user_visible_low_risk' | 'external_low_risk' | 'external_medium_risk' | 'external_high_risk';

export interface ActionEnvelope {
  action_id: string;
  mission_id?: string;
  run_id?: string;
  actor_type: ActionActorType;
  actor_id: string;
  department_id?: string;
  action_type: string;
  action_target?: string;
  provider_name?: string;
  tool_name?: string;
  side_effect_level: SideEffectLevel;
  data_sensitivity: DataSensitivity;
  budget_impact: BudgetImpact;
  user_visible_effect: boolean;
  external_effect: boolean;
  payload_summary: string;
  requested_at: string;
}

export interface ComplianceDecision {
  decision_id: string;
  action_id: string;
  verdict: ComplianceVerdict;
  severity: SeverityLevel;
  requires_human_approval: boolean;
  approval_reason?: string;
  policy_refs: string[];
  reason_codes: string[];
  explanation: string;
  decided_at: string;
}

export interface ComplianceReason {
  code: string;
  label: string;
  description: string;
  severity: SeverityLevel;
}

export interface ApprovalRequest {
  request_id: string;
  action_id: string;
  mission_id?: string;
  required_decision: string;
  recommended_option?: string;
  status: 'pending' | 'approved' | 'rejected';
  opened_at: string;
  resolved_at?: string;
  resolved_by?: string;
  decision_value?: string;
}

export interface ComplianceAuditEvent {
  audit_id: string;
  action_id: string;
  mission_id?: string;
  event_type: string;
  actor_id: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export const COMPLIANCE_REASONS: Record<string, ComplianceReason> = {
  SENSITIVE_DATA_EXPOSURE: { code: "SENSITIVE_DATA_EXPOSURE", label: "Sensitive Data Exposure", description: "Action would expose sensitive data to external system", severity: "critical" },
  HIGH_RISK_EXTERNAL_WRITE: { code: "HIGH_RISK_EXTERNAL_WRITE", label: "High Risk External Write", description: "Action has high side effects on external system", severity: "high" },
  PAYMENT_RELATED_ACTION: { code: "PAYMENT_RELATED_ACTION", label: "Payment Related Action", description: "Action involves payment or financial operations", severity: "critical" },
  SELLER_IMPACTING_MUTATION: { code: "SELLER_IMPACTING_MUTATION", label: "Seller Impacting Mutation", description: "Action modifies seller profile or data", severity: "high" },
  CUSTOMER_IMPACTING_MUTATION: { code: "CUSTOMER_IMPACTING_MUTATION", label: "Customer Impacting Mutation", description: "Action modifies customer profile or data", severity: "high" },
  BUDGET_THRESHOLD_EXCEEDED: { code: "BUDGET_THRESHOLD_EXCEEDED", label: "Budget Threshold Exceeded", description: "Action exceeds budget threshold", severity: "high" },
  POLICY_SCOPE_MISMATCH: { code: "POLICY_SCOPE_MISMATCH", label: "Policy Scope Mismatch", description: "Action scope exceeds allowed policy scope", severity: "medium" },
  UNAUTHORIZED_ACTION_TARGET: { code: "UNAUTHORIZED_ACTION_TARGET", label: "Unauthorized Action Target", description: "Action targets are not authorized for this actor", severity: "high" },
  INSUFFICIENT_CONTEXT: { code: "INSUFFICIENT_CONTEXT", label: "Insufficient Context", description: "Insufficient context to evaluate action safety", severity: "medium" },
  CONSTITUTIONAL_AMBIGUITY: { code: "CONSTITUTIONAL_AMBIGUITY", label: "Constitutional Ambiguity", description: "Action conflicts with constitutional principles", severity: "critical" },
  BULK_OPERATION_RISK: { code: "BULK_OPERATION_RISK", label: "Bulk Operation Risk", description: "Action is a bulk operation with high risk", severity: "high" },
  IRREVERSIBLE_SIDE_EFFECT: { code: "IRREVERSIBLE_SIDE_EFFECT", label: "Irreversible Side Effect", description: "Action has irreversible side effects", severity: "critical" },
};
