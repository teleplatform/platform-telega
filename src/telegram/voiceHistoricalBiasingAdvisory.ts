/**
 * Voice Historical Biasing Advisory Layer v1.8
 *
 * Applies historical trust scoring to current recommendations as an advisory overlay.
 * Tells the system whether a recommendation is historically supported, risky, or uncertain.
 *
 * This layer:
 *   - reads historical trust scores for the current recommendation type
 *   - classifies bias as: historically_supported / historically_uncertain / historically_risky
 *   - produces advisory summary with reasons and warnings
 *   - formats output for operator / policy review
 *
 * This layer does NOT:
 *   - mutate runtime decisions
 *   - change recommendation confidence
 *   - modify governance or apply logic
 *   - add DB / ML / external dependencies
 *   - auto-bias behavior
 */

import type { VoicePolicyRecommendation } from "./voiceAdaptivePolicyRecommendations.js";
import { getVoicePatchTrustScore } from "./voiceHistoricalTrustScoring.js";
import type { VoicePatchTrustScore } from "./voiceHistoricalTrustScoring.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceHistoricalBiasStatus =
  | "historically_supported"
  | "historically_uncertain"
  | "historically_risky";

export interface VoiceHistoricalBiasAdvisory {
  recommendationType: string;

  biasStatus: VoiceHistoricalBiasStatus;
  trustScore: number;

  advisoryWeight: "positive" | "neutral" | "negative";
  confidence: "low" | "medium" | "high";

  summary: string;

  reasons: string[];
  warnings: string[];

  generatedAtMs: number;
}

// ============================================================================
// Core advisory builder
// ============================================================================

/**
 * Build a historical bias advisory for a given recommendation.
 * Pure function — deterministic, bounded, read-only.
 */
export function buildVoiceHistoricalBiasAdvisory(
  recommendation: VoicePolicyRecommendation,
): VoiceHistoricalBiasAdvisory {
  const recType = recommendation.recommendationType;
  const now = Date.now();

  // Get historical trust score for this recommendation type
  const trustScore: VoicePatchTrustScore = getVoicePatchTrustScore(recType);

  // Determine bias status
  let biasStatus: VoiceHistoricalBiasStatus = "historically_uncertain";
  let advisoryWeight: "positive" | "neutral" | "negative" = "neutral";
  let summary = "";

  // RULE: historically_supported
  if (trustScore.trustScore >= 0.70 && trustScore.status === "trusted") {
    biasStatus = "historically_supported";
    advisoryWeight = "positive";
    summary = `This recommendation belongs to a historically trusted patch family (${recType.replace(/_/g, " ")} with trust score ${trustScore.trustScore.toFixed(2)}).`;
  }
  // RULE: historically_risky
  else if (trustScore.trustScore <= 0.35 && trustScore.status === "risky") {
    biasStatus = "historically_risky";
    advisoryWeight = "negative";
    summary = `This recommendation belongs to a patch family with rollback-heavy history (${recType.replace(/_/g, " ")} with trust score ${trustScore.trustScore.toFixed(2)}).`;
  }
  // RULE: historically_uncertain (default)
  else {
    biasStatus = "historically_uncertain";
    advisoryWeight = "neutral";
    if (trustScore.totalSamples === 0) {
      summary = `This recommendation has no historical support data. Proceeding without historical bias.`;
    } else {
      summary = `This recommendation has mixed or insufficient historical support (${recType.replace(/_/g, " ")} with trust score ${trustScore.trustScore.toFixed(2)}).`;
    }
  }

  // Inherit and normalize reasons/warnings from trust score
  const reasons = trustScore.reasons.length > 0 ? [...trustScore.reasons] : ["historical_signal_is_mixed"];
  const warnings = trustScore.warnings.length > 0 ? [...trustScore.warnings] : [];

  // Add advisory-specific warnings
  if (biasStatus === "historically_risky") {
    warnings.push("historical_bias_is_negative_for_this_family");
  }
  if (biasStatus === "historically_supported") {
    reasons.push("historically_confirmed_patch_family");
  }
  if (trustScore.totalSamples < 3) {
    warnings.push("low_historical_sample_volume");
  }

  return {
    recommendationType: recType,
    biasStatus,
    trustScore: trustScore.trustScore,
    advisoryWeight,
    confidence: trustScore.confidence,
    summary,
    reasons,
    warnings,
    generatedAtMs: now,
  };
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a historical bias advisory for operator review.
 */
export function formatVoiceHistoricalBiasAdvisory(
  advisory: VoiceHistoricalBiasAdvisory,
): string {
  const lines = [
    `🧭 Voice Historical Bias Advisory`,
    `• recommendation type: ${advisory.recommendationType}`,
    `• bias status: ${advisory.biasStatus}`,
    `• advisory weight: ${advisory.advisoryWeight}`,
    `• trust score: ${advisory.trustScore.toFixed(2)}`,
    `• confidence: ${advisory.confidence}`,
    `• summary: ${advisory.summary}`,
  ];

  if (advisory.reasons.length > 0) {
    lines.push(`• reasons: ${advisory.reasons.join(", ")}`);
  }
  if (advisory.warnings.length > 0) {
    lines.push(`• warnings: ${advisory.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
