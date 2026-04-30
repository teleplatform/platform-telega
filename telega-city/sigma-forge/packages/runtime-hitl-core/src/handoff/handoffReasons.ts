import type { HandoffReasonCode } from "../../runtime-hitl-contracts/src/handoff.js";

export const ALL_HANDOFF_REASONS: HandoffReasonCode[] = [
  "RISK_HIGH",
  "APPROVAL_REQUIRED",
  "POLICY_BLOCK",
  "CONFIDENCE_LOW",
  "COMMERCIAL_DECISION",
  "MANUAL_REVIEW_REQUIRED",
  "USER_INPUT_REQUIRED",
];

export function isValidHandoffReason(reason: string): reason is HandoffReasonCode {
  return ALL_HANDOFF_REASONS.includes(reason as HandoffReasonCode);
}

export function requiresHumanCheckpoint(context: {
  risk_level?: "low" | "medium" | "high";
  requires_approval?: boolean;
  confidence?: number;
  commercial_decision?: boolean;
  manual_review?: boolean;
  user_input_required?: boolean;
}): boolean {
  if (context.risk_level === "high") return true;
  if (context.requires_approval) return true;
  if (context.confidence !== undefined && context.confidence < 0.3) return true;
  if (context.commercial_decision) return true;
  if (context.manual_review) return true;
  if (context.user_input_required) return true;
  return false;
}
