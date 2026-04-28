/**
 * Voice Human Approval Decision Surface Layer v2.5
 *
 * Takes a VoiceApprovalReadinessDecision, VoiceApprovalRoutingDecision,
 * VoiceTrustAwareReviewPacket, and operator priority to produce a final
 * explainable human approval decision surface.
 *
 * This layer answers:
 *   - "Is human approval open, deferred, or blocked?"
 *   - "What exact action should the operator take?"
 *   - "What is the current approval state explanation?"
 *
 * This layer does NOT:
 *   - perform approval itself
 *   - change readiness state
 *   - alter routing decisions
 *   - modify priority
 *   - mutate runtime behavior
 *   - auto-present for approval
 */

import type { VoiceApprovalReadinessDecision } from "./voiceApprovalReadiness.js";
import type { VoiceApprovalRoutingDecision } from "./voiceApprovalRouting.js";
import type { VoiceTrustAwareReviewPacket } from "./voiceTrustAwareReviewPacket.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceHumanApprovalDecision =
  | "approval_open"
  | "approval_deferred"
  | "approval_blocked";

export interface VoiceHumanApprovalDecisionSurface {
  generatedAtMs: number;

  decision: VoiceHumanApprovalDecision;
  approvalEligible: boolean;

  actionMode: "approve_if_needed" | "observe_only" | "block_approval";

  summary: string;
  operatorInstruction: string;

  evidenceSufficiency: "low" | "medium" | "high";
  route: string;
  priority: string;

  reasons: string[];
  warnings: string[];
}

// ============================================================================
// Decision rules
// ============================================================================

/**
 * RULE 1 — approval_blocked
 *
 * Triggered by:
 *   - readinessStatus === "not_ready_risk_blocked"
 *   - approvalEligible === false AND route === "immediate_human_review"
 *
 * The case must remain blocked from human approval until risk is resolved.
 */
function evaluateApprovalBlocked(
  readiness: VoiceApprovalReadinessDecision,
  routing: VoiceApprovalRoutingDecision,
): boolean {
  return (
    readiness.readinessStatus === "not_ready_risk_blocked" ||
    (readiness.approvalEligible === false &&
      routing.route === "immediate_human_review")
  );
}

/**
 * RULE 2 — approval_deferred
 *
 * Triggered by:
 *   - readinessStatus === "needs_more_observation"
 *   - route === "observation_only"
 *   - route === "priority_operator_review"
 *
 * The case needs more evidence or operator review before approval can proceed.
 */
function evaluateApprovalDeferred(
  readiness: VoiceApprovalReadinessDecision,
  routing: VoiceApprovalRoutingDecision,
): boolean {
  return (
    readiness.readinessStatus === "needs_more_observation" ||
    routing.route === "observation_only" ||
    routing.route === "priority_operator_review"
  );
}

/**
 * RULE 3 — approval_open (default / safe path)
 *
 * Triggered when:
 *   - readinessStatus === "ready_for_human_approval"
 *   - approvalEligible === true
 *
 * The case is stable and safe to present for human approval when needed.
 */

// ============================================================================
// Core decision surface builder
// ============================================================================

/**
 * Build a human approval decision surface from readiness, routing, review, and priority.
 * Pure function — deterministic, bounded, read-only.
 */
export function buildVoiceHumanApprovalDecisionSurface(
  readiness: VoiceApprovalReadinessDecision,
  routing: VoiceApprovalRoutingDecision,
  review: VoiceTrustAwareReviewPacket,
  operatorPriority: { priority: string },
): VoiceHumanApprovalDecisionSurface {
  const reasons: string[] = [
    ...readiness.reasons,
    ...routing.reasons,
    ...review.reasons,
  ];
  const warnings: string[] = [
    ...readiness.warnings,
    ...routing.warnings,
    ...review.warnings,
  ];

  let decision: VoiceHumanApprovalDecision;
  let approvalEligible: boolean;
  let actionMode: "approve_if_needed" | "observe_only" | "block_approval";
  let summary: string;
  let operatorInstruction: string;

  // RULE 1 — approval_blocked
  if (evaluateApprovalBlocked(readiness, routing)) {
    decision = "approval_blocked";
    approvalEligible = false;
    actionMode = "block_approval";
    summary =
      "Voice case is blocked from human approval pending stabilization or risk resolution.";
    operatorInstruction =
      "Do not approve. Keep this case in incident/recovery workflow until risk state clears.";

    reasons.push("risk_state_blocks_human_approval");
    warnings.push("approval_must_remain_blocked_until_stabilization");
  }
  // RULE 2 — approval_deferred
  else if (evaluateApprovalDeferred(readiness, routing)) {
    decision = "approval_deferred";
    approvalEligible = false;
    actionMode = "observe_only";
    summary =
      "Voice case is not yet ready for approval and should remain under observation or operator review.";
    operatorInstruction =
      "Continue collecting evidence and review again after additional stable signals.";

    reasons.push("approval_deferred_pending_more_evidence");
    warnings.push("observation_should_continue_before_approval_consideration");
  }
  // RULE 3 — approval_open
  else {
    decision = "approval_open";
    approvalEligible = true;
    actionMode = "approve_if_needed";
    summary =
      "Voice case is sufficiently stable and historically supported for human approval consideration.";
    operatorInstruction =
      "Safe to present for human approval when operationally appropriate.";

    reasons.push("stable_state_supports_open_approval");
  }

  // Deduplicate and sort for deterministic output
  const uniqueReasons = Array.from(new Set(reasons)).sort();
  const uniqueWarnings = Array.from(new Set(warnings)).sort();

  return {
    generatedAtMs: Date.now(),
    decision,
    approvalEligible,
    actionMode,
    summary,
    operatorInstruction,
    evidenceSufficiency: readiness.evidenceSufficiency,
    route: routing.route,
    priority: operatorPriority.priority,
    reasons: uniqueReasons,
    warnings: uniqueWarnings,
  };
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a human approval decision surface for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceHumanApprovalDecisionSurface(
  surface: VoiceHumanApprovalDecisionSurface,
): string {
  const lines = [
    `🧾 Voice Human Approval Decision`,
    `• decision: ${surface.decision}`,
    `• approval eligible: ${surface.approvalEligible ? "yes" : "no"}`,
    `• action mode: ${surface.actionMode}`,
    `• route: ${surface.route}`,
    `• priority: ${surface.priority}`,
    `• evidence sufficiency: ${surface.evidenceSufficiency}`,
    `• summary: ${surface.summary}`,
    `• operator instruction: ${surface.operatorInstruction}`,
  ];

  if (surface.reasons.length > 0) {
    lines.push(`• reasons: ${surface.reasons.join(", ")}`);
  }
  if (surface.warnings.length > 0) {
    lines.push(`• warnings: ${surface.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
