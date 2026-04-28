/**
 * Voice Trust-Aware Operator Prioritization Layer v2.2
 *
 * Takes a VoiceTrustAwareReviewPacket and determines how urgently
 * a human operator needs to look at this voice case.
 *
 * This layer answers:
 *   - "How urgent is this voice review for human attention?"
 *   - "Which queue bucket should it route to?"
 *   - "Is escalation required?"
 *
 * This layer does NOT:
 *   - mutate the review packet
 *   - change governance advisory decisions
 *   - change shaped recommendations
 *   - change runtime decisions
 *   - auto-approve / auto-deny anything
 */

import type { VoiceTrustAwareReviewPacket } from "./voiceTrustAwareReviewPacket.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceOperatorPriority =
  | "p0_immediate"
  | "p1_high"
  | "p2_normal"
  | "p3_low";

export interface VoiceOperatorPriorityDecision {
  generatedAtMs: number;

  priority: VoiceOperatorPriority;
  escalationRequired: boolean;

  queueBucket: "incident" | "review" | "observe" | "archive";

  summary: string;
  operatorRoutingHint: string;

  reasons: string[];
  warnings: string[];
}

// ============================================================================
// Priority evaluation logic
// ============================================================================

/**
 * RULE 1 — P0 IMMEDIATE
 * Triggered by: blocked runtime, risk-flagged governance, or deny decision.
 */
function evaluateP0(packet: VoiceTrustAwareReviewPacket): boolean {
  return (
    packet.status === "blocked" ||
    packet.governance.governanceAdvisoryStatus === "governance_risk_flagged" ||
    packet.governance.applyDecision === "deny"
  );
}

/**
 * RULE 2 — P1 HIGH
 * Triggered by: degraded runtime, high advisory severity,
 * or high priority recommendation with low trust.
 */
function evaluateP1(packet: VoiceTrustAwareReviewPacket): boolean {
  return (
    packet.status === "degraded" ||
    packet.governance.advisorySeverity === "high" ||
    (packet.recommendation.priority === "high" && packet.recommendation.trustScore < 0.5)
  );
}

/**
 * RULE 3 — P2 NORMAL
 * Triggered by: watch status or governance caution.
 */
function evaluateP2(packet: VoiceTrustAwareReviewPacket): boolean {
  return (
    packet.status === "watch" ||
    packet.governance.governanceAdvisoryStatus === "governance_caution"
  );
}

// ============================================================================
// Core prioritization function
// ============================================================================

/**
 * Determine the operator priority from a trust-aware review packet.
 * Pure function — deterministic, bounded, read-only.
 */
export function determineVoiceOperatorPriority(
  packet: VoiceTrustAwareReviewPacket,
): VoiceOperatorPriorityDecision {
  const now = Date.now();

  const reasons: string[] = [...packet.reasons];
  const warnings: string[] = [...packet.warnings];

  let priority: VoiceOperatorPriority;
  let escalationRequired: boolean;
  let queueBucket: "incident" | "review" | "observe" | "archive";
  let summary: string;
  let operatorRoutingHint: string;

  // RULE 1 — P0 IMMEDIATE
  if (evaluateP0(packet)) {
    priority = "p0_immediate";
    escalationRequired = true;
    queueBucket = "incident";
    summary = "Immediate operator attention required due to blocked or risk-flagged voice governance state.";
    operatorRoutingHint = "Escalate to immediate review and block any premature approval path.";

    reasons.push("blocked_runtime_requires_immediate_attention");
    warnings.push("operator_attention_should_not_be_delayed");
  }
  // RULE 2 — P1 HIGH
  else if (evaluateP1(packet)) {
    priority = "p1_high";
    escalationRequired = true;
    queueBucket = "review";
    summary = "High-priority operator review recommended due to degraded or unstable trust-aware voice state.";
    operatorRoutingHint = "Route to active operator review queue for near-term inspection.";

    reasons.push("degraded_voice_state_requires_review");
    warnings.push("historical_risk_should_be_reviewed_before_approval");
  }
  // RULE 3 — P2 NORMAL
  else if (evaluateP2(packet)) {
    priority = "p2_normal";
    escalationRequired = false;
    queueBucket = "observe";
    summary = "Normal operator observation is sufficient while trust-aware review remains in caution mode.";
    operatorRoutingHint = "Keep in observation queue and continue collecting evidence.";

    reasons.push("caution_state_allows_observation");
    warnings.push("continue_evidence_collection_before_escalation");
  }
  // RULE 4 — P3 LOW (default)
  else {
    priority = "p3_low";
    escalationRequired = false;
    queueBucket = "archive";
    summary = "Low operator priority — trust-aware voice runtime appears healthy and stable.";
    operatorRoutingHint = "No immediate review needed. Safe for passive monitoring only.";

    reasons.push("healthy_runtime_allows_low_priority");
  }

  // Deduplicate and sort for deterministic output
  const uniqueReasons = Array.from(new Set(reasons)).sort();
  const uniqueWarnings = Array.from(new Set(warnings)).sort();

  return {
    generatedAtMs: now,
    priority,
    escalationRequired,
    queueBucket,
    summary,
    operatorRoutingHint,
    reasons: uniqueReasons,
    warnings: uniqueWarnings,
  };
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format an operator priority decision for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceOperatorPriorityDecision(
  decision: VoiceOperatorPriorityDecision,
): string {
  const lines = [
    `🚨 Voice Operator Priority`,
    `• priority: ${decision.priority}`,
    `• escalation required: ${decision.escalationRequired ? "yes" : "no"}`,
    `• queue bucket: ${decision.queueBucket}`,
    `• summary: ${decision.summary}`,
    `• routing hint: ${decision.operatorRoutingHint}`,
  ];

  if (decision.reasons.length > 0) {
    lines.push(`• reasons: ${decision.reasons.join(", ")}`);
  }
  if (decision.warnings.length > 0) {
    lines.push(`• warnings: ${decision.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
