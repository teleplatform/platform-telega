export type HandoffType = 'approval_required' | 'escalation_required' | 'ambiguity_resolution' | 'policy_conflict' | 'missing_context' | 'manual_override_required';
export type HandoffStatus = 'open' | 'waiting' | 'answered' | 'expired' | 'cancelled' | 'resolved';
export type RequestedDecision = 'approve' | 'reject' | 'choose_option' | 'provide_input' | 'manual_execute' | 'cancel_mission';
export type HumanDecisionType = 'approved' | 'rejected' | 'option_selected' | 'input_provided' | 'manual_execution_confirmed' | 'mission_cancelled';
export type ResumeMode = 'continue_same_run' | 'continue_new_run' | 'retry_from_checkpoint' | 'cancel_after_rejection' | 'manual_close';
export type ResumeResultStatus = 'resumed' | 'not_resumed' | 'cancelled' | 'blocked';
export type ResumedBy = 'human_decision' | 'system_timeout' | 'operator_override';
export type HitlEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export const ESCALATION_REASONS: Record<string, { label: string; severity: HitlEventSeverity }> = {
  APPROVAL_REQUIRED: { label: "Approval Required", severity: "high" },
  POLICY_CONFLICT: { label: "Policy Conflict", severity: "critical" },
  INSUFFICIENT_CONTEXT: { label: "Insufficient Context", severity: "medium" },
  HIGH_RISK_ACTION: { label: "High Risk Action", severity: "high" },
  BUDGET_CONFIRMATION_REQUIRED: { label: "Budget Confirmation Required", severity: "high" },
  CONSTITUTIONAL_AMBIGUITY: { label: "Constitutional Ambiguity", severity: "critical" },
  MANUAL_REVIEW_REQUIRED: { label: "Manual Review Required", severity: "high" },
  TRANSPORT_RECOVERY_DECISION: { label: "Transport Recovery Decision", severity: "high" },
  CUSTOMER_IMPACT_REVIEW: { label: "Customer Impact Review", severity: "medium" },
  SELLER_IMPACT_REVIEW: { label: "Seller Impact Review", severity: "medium" },
};

export interface HandoffPacket {
  handoff_id: string;
  mission_id: string;
  run_id?: string;
  action_id?: string;
  department_id?: string;
  handoff_type: HandoffType;
  reason_code: string;
  summary: string;
  requested_decision: RequestedDecision;
  options_json?: string;
  recommended_option?: string;
  paused_stage: string;
  paused_at: string;
  decision_ttl_at?: string;
  status: HandoffStatus;
  created_at: string;
  updated_at: string;
}

export interface HumanDecision {
  decision_id: string;
  handoff_id: string;
  mission_id: string;
  actor_id: string;
  decision: HumanDecisionType;
  selected_option?: string;
  input_payload_json?: string;
  note?: string;
  decided_at: string;
}

export interface ResumeContract {
  resume_id: string;
  handoff_id: string;
  mission_id: string;
  run_id?: string;
  resume_mode: ResumeMode;
  resume_payload_json?: string;
  resumed_by: ResumedBy;
  resumed_at: string;
  result_status: ResumeResultStatus;
  reason?: string;
}

export interface HitlAuditEvent {
  audit_id: string;
  handoff_id?: string;
  mission_id?: string;
  event_type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
