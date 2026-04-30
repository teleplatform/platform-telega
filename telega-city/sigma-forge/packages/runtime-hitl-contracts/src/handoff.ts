export type HandoffReasonCode =
  | "RISK_HIGH"
  | "APPROVAL_REQUIRED"
  | "POLICY_BLOCK"
  | "CONFIDENCE_LOW"
  | "COMMERCIAL_DECISION"
  | "MANUAL_REVIEW_REQUIRED"
  | "USER_INPUT_REQUIRED";

export interface HumanHandoffPacket {
  handoff_id: string;
  task_id: string;
  run_id?: string;
  node_id?: string;
  summary: string;
  completed_steps: string[];
  blocked_reason?: string;
  recommended_action?: string;
  draft_output?: string;
  required_human_input?: string[];
  risk_flags?: string[];
  rejected_options?: string[];
  reason_code: HandoffReasonCode;
  created_at: string;
}
