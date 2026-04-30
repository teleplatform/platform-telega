import type { HandoffReasonCode } from "../../runtime-hitl-contracts/src/handoff.js";
import { isValidHandoffReason, requiresHumanCheckpoint } from "./handoffReasons.js";

export interface HandoffContext {
  risk_level?: "low" | "medium" | "high";
  requires_approval?: boolean;
  confidence?: number;
  commercial_decision?: boolean;
  manual_review?: boolean;
  user_input_required?: boolean;
  task_class?: string;
}

export interface ClassifiedHandoff {
  requires_checkpoint: boolean;
  reason_code: HandoffReasonCode;
  risk_flags: string[];
}

export function classifyHandoffContext(context: HandoffContext): ClassifiedHandoff {
  const risk_flags: string[] = [];
  let reason_code: HandoffReasonCode = "MANUAL_REVIEW_REQUIRED";

  if (context.risk_level === "high") {
    reason_code = "RISK_HIGH";
    risk_flags.push("high_risk_execution");
  }
  if (context.requires_approval) {
    reason_code = "APPROVAL_REQUIRED";
    risk_flags.push("approval_required");
  }
  if (context.confidence !== undefined && context.confidence < 0.3) {
    reason_code = "CONFIDENCE_LOW";
    risk_flags.push(`low_confidence: ${context.confidence}`);
  }
  if (context.commercial_decision) {
    reason_code = "COMMERCIAL_DECISION";
    risk_flags.push("commercial_decision_needed");
  }
  if (context.manual_review) {
    reason_code = "MANUAL_REVIEW_REQUIRED";
    risk_flags.push("manual_review_flagged");
  }
  if (context.user_input_required) {
    reason_code = "USER_INPUT_REQUIRED";
    risk_flags.push("user_input_needed");
  }

  return {
    requires_checkpoint: requiresHumanCheckpoint(context),
    reason_code,
    risk_flags,
  };
}
