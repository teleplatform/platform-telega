/**
 * Voice Trust-Aware Approval Routing Layer v2.3
 *
 * Takes a VoiceOperatorPriorityDecision and VoiceTrustAwareReviewPacket
 * and determines the concrete approval route and target control lane.
 *
 * This layer answers:
 *   - "Where should this voice review be routed?"
 *   - "Does it require human approval?"
 *   - "Which control lane should accept it?"
 *
 * This layer does NOT:
 *   - approve / deny anything
 *   - mutate runtime decisions
 *   - change the applyDecision
 *   - alter controlled apply behavior
 *   - auto-route outside its defined lanes
 */

import type { VoiceOperatorPriorityDecision } from "./voiceOperatorPrioritization.js";
import type { VoiceTrustAwareReviewPacket } from "./voiceTrustAwareReviewPacket.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceApprovalRoute =
  | "immediate_human_review"
  | "priority_operator_review"
  | "observation_only"
  | "passive_archive";

export interface VoiceApprovalRoutingDecision {
  generatedAtMs: number;

  route: VoiceApprovalRoute;
  approvalRequired: boolean;

  targetLane:
    | "incident_lane"
    | "review_lane"
    | "observation_lane"
    | "archive_lane";

  summary: string;
  routingReason: string;

  reasons: string[];
  warnings: string[];
}

// ============================================================================
// Routing rules
// ============================================================================

/**
 * RULE 1 — immediate_human_review
 * Triggered by: p0_immediate priority.
 *
 * The case must go straight into the incident lane for immediate human review.
 */
function routeP0(): VoiceApprovalRoutingDecision {
  return {
    generatedAtMs: Date.now(),
    route: "immediate_human_review",
    approvalRequired: true,
    targetLane: "incident_lane",
    summary:
      "Voice case routed to immediate human review due to critical priority level.",
    routingReason:
      "P0 priority indicates blocked or risk-flagged state requiring immediate human intervention.",
    reasons: ["p0_priority_requires_immediate_human_review"],
    warnings: ["no_automated_approval_path_available"],
  };
}

/**
 * RULE 2 — priority_operator_review
 * Triggered by: p1_high priority.
 *
 * The case should go into the review lane for prioritized operator review.
 */
function routeP1(): VoiceApprovalRoutingDecision {
  return {
    generatedAtMs: Date.now(),
    route: "priority_operator_review",
    approvalRequired: true,
    targetLane: "review_lane",
    summary:
      "Voicecase routed to priority operator review due to high-priority trust concerns.",
    routingReason:
      "P1 priority indicates degraded or unstable voice state requiring near-term operator review.",
    reasons: ["p1_priority_requires_priority_operator_review"],
    warnings: ["approval_should_not_be_deferred_indefinitely"],
  };
}

/**
 * RULE 3 — observation_only
 * Triggered by: p2_normal priority.
 *
 * The case goes to observation lane — no approval required, just monitoring.
 */
function routeP2(): VoiceApprovalRoutingDecision {
  return {
    generatedAtMs: Date.now(),
    route: "observation_only",
    approvalRequired: false,
    targetLane: "observation_lane",
    summary:
      "Voice case placed in observation lane — normal priority with no immediate approval needed.",
    routingReason:
      "P2 priority indicates caution or watch state — sufficient to observe without active review.",
    reasons: ["p2_priority_allows_observation_only"],
    warnings: ["continue_monitoring_before_escalation"],
  };
}

/**
 * RULE 4 — passive_archive
 * Triggered by: p3_low priority.
 *
 * The case is archived passively — healthy, low-risk, no action needed.
 */
function routeP3(): VoiceApprovalRoutingDecision {
  return {
    generatedAtMs: Date.now(),
    route: "passive_archive",
    approvalRequired: false,
    targetLane: "archive_lane",
    summary:
      "Voice case archived passively — healthy and stable with no operator action required.",
    routingReason:
      "P3 priority indicates healthy, low-risk voice state safe for passive archiving.",
    reasons: ["p3_priority_allows_passive_archive"],
    warnings: [],
  };
}

// ============================================================================
// Core routing function
// ============================================================================

/**
 * Determine the approval routing from a priority decision and review packet.
 * Pure function — deterministic, bounded, read-only.
 */
export function determineVoiceApprovalRoute(
  _priorityDecision: VoiceOperatorPriorityDecision,
  _reviewPacket: VoiceTrustAwareReviewPacket,
): VoiceApprovalRoutingDecision {
  // NOTE: _reviewPacket is accepted for future enrichment (historical context,
  // trust signals, governance annotations) but is NOT used in v2.3 routing.
  // The route is determined solely from the priority decision in this version.

  switch (_priorityDecision.priority) {
    case "p0_immediate":
      return routeP0();
    case "p1_high":
      return routeP1();
    case "p2_normal":
      return routeP2();
    case "p3_low":
      return routeP3();
    default:
      // Fallback — treat as observation only to avoid unsafe auto-approval.
      return {
        generatedAtMs: Date.now(),
        route: "observation_only",
        approvalRequired: false,
        targetLane: "observation_lane",
        summary:
          "Voice case placed in observation lane due to unrecognized priority level.",
        routingReason:
          `Unrecognized priority "${_priorityDecision.priority}" — defaulting to safe observation lane.`,
        reasons: ["unrecognized_priority_fallback_to_observation"],
        warnings: ["operator_should_verify_priority_classification"],
      };
  }
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format an approval routing decision for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceApprovalRoutingDecision(
  decision: VoiceApprovalRoutingDecision,
): string {
  const lines = [
    `🧭 Voice Approval Routing`,
    `• route: ${decision.route}`,
    `• approval required: ${decision.approvalRequired ? "yes" : "no"}`,
    `• target lane: ${decision.targetLane}`,
    `• summary: ${decision.summary}`,
    `• routing reason: ${decision.routingReason}`,
  ];

  if (decision.reasons.length > 0) {
    lines.push(`• reasons: ${decision.reasons.join(", ")}`);
  }
  if (decision.warnings.length > 0) {
    lines.push(`• warnings: ${decision.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
