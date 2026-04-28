/**
 * Voice Trust-Aware Human Approval Readiness Layer v2.4
 *
 * Takes a VoiceApprovalRoutingDecision and VoiceTrustAwareReviewPacket
 * and determines whether this case is actually ready for human approval.
 *
 * This layer answers:
 *   - "Is this case ready for human approval?"
 *   - "Is there enough evidence to safely present it?"
 *   - "Should a human be allowed to approve this now?"
 *
 * This layer does NOT:
 *   - approve / deny anything
 *   - mutate routing decisions
 *   - change governance state
 *   - alter runtime decisions
 *   - auto-present for approval
 */

import type { VoiceApprovalRoutingDecision } from "./voiceApprovalRouting.js";
import type { VoiceTrustAwareReviewPacket } from "./voiceTrustAwareReviewPacket.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceApprovalReadinessStatus =
  | "ready_for_human_approval"
  | "needs_more_observation"
  | "not_ready_risk_blocked";

export interface VoiceApprovalReadinessDecision {
  generatedAtMs: number;

  readinessStatus: VoiceApprovalReadinessStatus;
  approvalEligible: boolean;

  evidenceSufficiency: "low" | "medium" | "high";
  humanApprovalRecommended: boolean;

  summary: string;
  operatorGuidance: string;

  reasons: string[];
  warnings: string[];
}

// ============================================================================
// Readiness rules
// ============================================================================

/**
 * RULE 1 — not_ready_risk_blocked
 *
 * Triggered by:
 *   - immediate_human_review route
 *   - governance_risk_flagged advisory
 *   - blocked status
 *
 * The case is too risky to even present for human approval.
 * Incident handling or stabilization must come first.
 */
function evaluateRiskBlocked(
  routingDecision: VoiceApprovalRoutingDecision,
  reviewPacket: VoiceTrustAwareReviewPacket,
): boolean {
  return (
    routingDecision.route === "immediate_human_review" ||
    reviewPacket.governance.governanceAdvisoryStatus ===
      "governance_risk_flagged" ||
    reviewPacket.status === "blocked"
  );
}

/**
 * RULE 2 — needs_more_observation
 *
 * Triggered by:
 *   - priority_operator_review route
 *   - observation_only route
 *   - governance_caution advisory
 *   - watch status
 *   - trustScore < 0.70
 *
 * The case needs more evidence before it can safely be presented for approval.
 */
function evaluateNeedsObservation(
  routingDecision: VoiceApprovalRoutingDecision,
  reviewPacket: VoiceTrustAwareReviewPacket,
): boolean {
  return (
    routingDecision.route === "priority_operator_review" ||
    routingDecision.route === "observation_only" ||
    reviewPacket.governance.governanceAdvisoryStatus === "governance_caution" ||
    reviewPacket.status === "watch" ||
    reviewPacket.recommendation.trustScore < 0.7
  );
}

/**
 * RULE 3 — ready_for_human_approval (default / safe path)
 *
 * Triggered when:
 *   - not risk-blocked
 *   - not needing more observation
 *   - stable, healthy, governance-supported state
 *   - trustScore >= 0.70
 *
 * The case is sufficiently stable and historically supported for human approval.
 */

// ============================================================================
// Core readiness function
// ============================================================================

/**
 * Determine approval readiness from a routing decision and review packet.
 * Pure function — deterministic, bounded, read-only.
 */
export function determineVoiceApprovalReadiness(
  routingDecision: VoiceApprovalRoutingDecision,
  reviewPacket: VoiceTrustAwareReviewPacket,
): VoiceApprovalReadinessDecision {
  const reasons: string[] = [...routingDecision.reasons, ...reviewPacket.reasons];
  const warnings: string[] = [
    ...routingDecision.warnings,
    ...reviewPacket.warnings,
  ];

  let readinessStatus: VoiceApprovalReadinessStatus;
  let approvalEligible: boolean;
  let evidenceSufficiency: "low" | "medium" | "high";
  let humanApprovalRecommended: boolean;
  let summary: string;
  let operatorGuidance: string;

  // RULE 1 — not_ready_risk_blocked
  if (evaluateRiskBlocked(routingDecision, reviewPacket)) {
    readinessStatus = "not_ready_risk_blocked";
    approvalEligible = false;
    evidenceSufficiency = "low";
    humanApprovalRecommended = false;
    summary =
      "Voice case is not ready for human approval due to blocked or risk-flagged trust-aware state.";
    operatorGuidance =
      "Do not approve. Continue incident handling or stabilization workflow first.";

    reasons.push("risk_blocked_prevents_approval_readiness");
    warnings.push("approval_should_not_be_attempted_until_stabilization");
  }
  // RULE 2 — needs_more_observation
  else if (evaluateNeedsObservation(routingDecision, reviewPacket)) {
    readinessStatus = "needs_more_observation";
    approvalEligible = false;
    evidenceSufficiency = "medium";
    humanApprovalRecommended = true;
    summary =
      "Voice case requires more observation before safe human approval can be considered.";
    operatorGuidance =
      "Review signals and continue evidence collection before granting approval.";

    reasons.push("insufficient_evidence_for_safe_approval");
    warnings.push("continue_observation_before_approval_consideration");
  }
  // RULE 3 — ready_for_human_approval
  else {
    readinessStatus = "ready_for_human_approval";
    approvalEligible = true;
    evidenceSufficiency = "high";
    humanApprovalRecommended = true;
    summary =
      "Voice case is sufficiently stable and historically supported for human approval review.";
    operatorGuidance =
      "Safe to present for human approval if operationally needed.";

    reasons.push("stable_state_supports_approval_readiness");
  }

  // Deduplicate and sort for deterministic output
  const uniqueReasons = Array.from(new Set(reasons)).sort();
  const uniqueWarnings = Array.from(new Set(warnings)).sort();

  return {
    generatedAtMs: Date.now(),
    readinessStatus,
    approvalEligible,
    evidenceSufficiency,
    humanApprovalRecommended,
    summary,
    operatorGuidance,
    reasons: uniqueReasons,
    warnings: uniqueWarnings,
  };
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format an approval readiness decision for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceApprovalReadinessDecision(
  decision: VoiceApprovalReadinessDecision,
): string {
  const lines = [
    `🧪 Voice Approval Readiness`,
    `• readiness status: ${decision.readinessStatus}`,
    `• approval eligible: ${decision.approvalEligible ? "yes" : "no"}`,
    `• evidence sufficiency: ${decision.evidenceSufficiency}`,
    `• human approval recommended: ${decision.humanApprovalRecommended ? "yes" : "no"}`,
    `• summary: ${decision.summary}`,
    `• operator guidance: ${decision.operatorGuidance}`,
  ];

  if (decision.reasons.length > 0) {
    lines.push(`• reasons: ${decision.reasons.join(", ")}`);
  }
  if (decision.warnings.length > 0) {
    lines.push(`• warnings: ${decision.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
