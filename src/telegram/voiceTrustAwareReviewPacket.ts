/**
 * Voice Trust-Aware Review Packet Shaping Layer v2.1
 *
 * Assembles VoiceReviewPacket, VoiceShapedRecommendation, and
 * VoiceTrustAwareGovernanceAdvisory into a single trust-aware review object
 * suitable for operator review, admin telemetry, and future dashboard surfaces.
 *
 * This layer:
 *   - reads existing review packet, shaped recommendation, governance advisory
 *   - produces a unified VoiceTrustAwareReviewPacket
 *   - enriches summary with trust-aware context
 *   - merges reasons/warnings deterministically without duplicates
 *   - suggests operator actions based on governance advisory status
 *
 * This layer does NOT:
 *   - mutate review.status
 *   - mutate governed apply decisions
 *   - mutate shaped recommendation
 *   - mutate runtime decisions
 *   - auto-approve anything
 */

import type { VoiceReviewPacket } from "./voiceReviewSurface.js";
import type { VoiceShapedRecommendation } from "./voiceTrustAwareRecommendationShaping.js";
import type { VoiceTrustAwareGovernanceAdvisory } from "./voiceTrustAwareGovernanceAdvisory.js";

// ============================================================================
// Domain model
// ============================================================================

export interface VoiceTrustAwareReviewPacket {
  generatedAtMs: number;

  status: "healthy" | "watch" | "degraded" | "blocked";

  headline: string;
  operatorSummary: string;

  trustAwareSummary: string;

  recommendation: {
    type: string;
    originalConfidence: string;
    shapedConfidence: string;
    priority: string;
    trustScore: number;
    biasStatus: string;
  };

  governance: {
    applyDecision: string;
    governanceAdvisoryStatus: string;
    advisorySeverity: string;
  };

  metrics: {
    voiceSuccessRate: number;
    fallbackRate: number;
    interruptionBlockRate: number;
    avgQualityScore: number;
    avgLatencyMs: number;
    totalSignals: number;
  };

  reasons: string[];
  warnings: string[];

  suggestedOperatorAction: string;
}

// ============================================================================
// Trust-aware summary builder
// ============================================================================

function buildTrustAwareSummary(
  governanceAdvisory: VoiceTrustAwareGovernanceAdvisory,
): string {
  switch (governanceAdvisory.governanceAdvisoryStatus) {
    case "governance_supported":
      return "Voice review is historically supported with high-confidence shaping and low governance risk.";
    case "governance_caution":
      return "Voice review remains in caution mode due to mixed historical support or incomplete evidence.";
    case "governance_risk_flagged":
      return "Voice review is risk-flagged due to rollback-heavy history or governance denial.";
    default:
      return "Voice review governance advisory status is unrecognized.";
  }
}

// ============================================================================
// Operator action shaping
// ============================================================================

function determineTrustAwareOperatorAction(
  governanceAdvisory: VoiceTrustAwareGovernanceAdvisory,
): string {
  switch (governanceAdvisory.governanceAdvisoryStatus) {
    case "governance_supported":
      return "Safe to continue observation or operator approval flow.";
    case "governance_caution":
      return "Continue observation and avoid premature policy escalation.";
    case "governance_risk_flagged":
      return "Avoid operator approval until historical risk profile stabilizes.";
    default:
      return "Review governance advisory status for recommended operator action.";
  }
}

// ============================================================================
// Deterministic merge of reasons and warnings
// ============================================================================

function mergeDeterministic(
  ...arrays: string[][]
): string[] {
  const merged = new Set<string>();
  for (const arr of arrays) {
    for (const item of arr) {
      merged.add(item);
    }
  }
  return Array.from(merged).sort();
}

// ============================================================================
// Core builder function
// ============================================================================

/**
 * Build a trust-aware review packet from review + shaped recommendation + governance advisory.
 * Pure function — deterministic, bounded, read-only.
 */
export function buildVoiceTrustAwareReviewPacket(
  review: VoiceReviewPacket,
  shapedRecommendation: VoiceShapedRecommendation,
  governanceAdvisory: VoiceTrustAwareGovernanceAdvisory,
): VoiceTrustAwareReviewPacket {
  const now = Date.now();

  const trustAwareSummary = buildTrustAwareSummary(governanceAdvisory);
  const suggestedOperatorAction = determineTrustAwareOperatorAction(governanceAdvisory);

  // Merge reasons and warnings from all sources (deduplicated, deterministic order)
  const reasons = mergeDeterministic(
    review.blockers,
    shapedRecommendation.reasons,
    governanceAdvisory.reasons,
  );

  const warnings = mergeDeterministic(
    review.warnings,
    shapedRecommendation.warnings,
    governanceAdvisory.warnings,
  );

  return {
    generatedAtMs: now,
    status: review.status,
    headline: review.headline,
    operatorSummary: review.operatorSummary,
    trustAwareSummary,
    recommendation: {
      type: shapedRecommendation.originalType,
      originalConfidence: shapedRecommendation.originalConfidence,
      shapedConfidence: shapedRecommendation.shapedConfidence,
      priority: shapedRecommendation.priority,
      trustScore: shapedRecommendation.trustScore,
      biasStatus: shapedRecommendation.biasStatus,
    },
    governance: {
      applyDecision: governanceAdvisory.applyDecision,
      governanceAdvisoryStatus: governanceAdvisory.governanceAdvisoryStatus,
      advisorySeverity: governanceAdvisory.advisorySeverity,
    },
    metrics: {
      voiceSuccessRate: review.metrics.voiceSuccessRate,
      fallbackRate: review.metrics.fallbackRate,
      interruptionBlockRate: review.metrics.interruptionBlockRate,
      avgQualityScore: review.metrics.avgQualityScore,
      avgLatencyMs: review.metrics.avgLatencyMs,
      totalSignals: review.metrics.totalSignals,
    },
    reasons,
    warnings,
    suggestedOperatorAction,
  };
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a trust-aware review packet for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceTrustAwareReviewPacket(
  packet: VoiceTrustAwareReviewPacket,
): string {
  const lines = [
    `🧠 Voice Trust-Aware Review`,
    `• status: ${packet.status}`,
    `• headline: ${packet.headline}`,
    `• recommendation: ${packet.recommendation.type}`,
    `• shaped confidence: ${packet.recommendation.shapedConfidence}`,
    `• priority: ${packet.recommendation.priority}`,
    `• trust score: ${packet.recommendation.trustScore.toFixed(2)}`,
    `• governance advisory: ${packet.governance.governanceAdvisoryStatus}`,
    `• advisory severity: ${packet.governance.advisorySeverity}`,
    `• operator action: ${packet.suggestedOperatorAction}`,
    `• success: ${packet.metrics.voiceSuccessRate.toFixed(1)}%`,
    `• fallback: ${packet.metrics.fallbackRate.toFixed(1)}%`,
    `• interruption block: ${packet.metrics.interruptionBlockRate.toFixed(1)}%`,
    `• avg quality: ${packet.metrics.avgQualityScore}`,
    `• avg latency: ${packet.metrics.avgLatencyMs.toFixed(0)}ms`,
    `• total signals: ${packet.metrics.totalSignals}`,
  ];

  if (packet.reasons.length > 0) {
    lines.push(`• reasons: ${packet.reasons.join(", ")}`);
  }
  if (packet.warnings.length > 0) {
    lines.push(`• warnings: ${packet.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
