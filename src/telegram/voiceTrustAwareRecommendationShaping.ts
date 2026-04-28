/**
 * Voice Trust-Aware Recommendation Shaping Layer v1.9
 *
 * Takes a current recommendation + historical trust + bias advisory
 * and produces a shaped recommendation with adjusted confidence and priority.
 *
 * This layer:
 *   - increases confidence for historically supported patches
 *   - decreases confidence for historically risky patches
 *   - assigns priority hints based on trust status
 *   - never changes recommendation type
 *   - never mutates runtime decisions
 *
 * This layer does NOT:
 *   - change recommendationType
 *   - change governed apply logic
 *   - change apply engine
 *   - auto-apply based on trust
 *   - mutate runtime config
 */

import type { VoicePolicyRecommendation } from "./voiceAdaptivePolicyRecommendations.js";
import { buildVoiceHistoricalBiasAdvisory } from "./voiceHistoricalBiasingAdvisory.js";
import type { VoiceHistoricalBiasAdvisory, VoiceHistoricalBiasStatus } from "./voiceHistoricalBiasingAdvisory.js";
import { getVoicePatchTrustScore } from "./voiceHistoricalTrustScoring.js";

// ============================================================================
// Domain model
// ============================================================================

export interface VoiceShapedRecommendation {
  originalType: string;

  originalConfidence: "low" | "medium" | "high";
  shapedConfidence: "low" | "medium" | "high";

  priority: "low" | "normal" | "high";

  trustScore: number;
  biasStatus: VoiceHistoricalBiasStatus;

  summary: string;

  reasons: string[];
  warnings: string[];

  generatedAtMs: number;
}

// ============================================================================
// Core shaping function
// ============================================================================

/**
 * Shape a recommendation's confidence and priority based on historical trust.
 * Pure function — deterministic, bounded, read-only.
 */
export function shapeVoiceRecommendationWithTrust(
  recommendation: VoicePolicyRecommendation,
): VoiceShapedRecommendation {
  const now = Date.now();
  const recType = recommendation.recommendationType;
  const originalConfidence = recommendation.confidence;

  // Get historical bias advisory
  const biasAdvisory: VoiceHistoricalBiasAdvisory = buildVoiceHistoricalBiasAdvisory(recommendation);
  const biasStatus = biasAdvisory.biasStatus;
  const trustScore = biasAdvisory.trustScore;

  // Determine shaped confidence and priority
  let shapedConfidence = originalConfidence;
  let priority: "low" | "normal" | "high" = "normal";
  let summary = "";

  const reasons: string[] = [...biasAdvisory.reasons];
  const warnings: string[] = [...biasAdvisory.warnings];

  // RULE 1 — historically_supported
  if (biasStatus === "historically_supported") {
    switch (originalConfidence) {
      case "low":
        shapedConfidence = "medium";
        break;
      case "medium":
        shapedConfidence = "high";
        break;
      case "high":
        shapedConfidence = "high";
        break;
    }
    priority = "high";
    summary = "Recommendation confidence increased due to strong historical support.";
    reasons.push("historical_support_strengthens_recommendation");
  }
  // RULE 2 — historically_risky
  else if (biasStatus === "historically_risky") {
    switch (originalConfidence) {
      case "high":
        shapedConfidence = "medium";
        break;
      case "medium":
        shapedConfidence = "low";
        break;
      case "low":
        shapedConfidence = "low";
        break;
    }
    priority = "low";
    summary = "Recommendation confidence reduced due to rollback-heavy historical trust profile.";
    warnings.push("historical_risk_reduces_recommendation_confidence");
  }
  // RULE 3 — historically_uncertain
  else {
    shapedConfidence = originalConfidence;
    priority = "normal";
    summary = "Recommendation remains unchanged due to mixed or insufficient historical evidence.";
    warnings.push("historical_evidence_is_mixed_or_limited");
  }

  // Deduplicate reasons and warnings
  const uniqueReasons = [...new Set(reasons)];
  const uniqueWarnings = [...new Set(warnings)];

  // Deterministic sort
  uniqueReasons.sort();
  uniqueWarnings.sort();

  return {
    originalType: recType,
    originalConfidence,
    shapedConfidence,
    priority,
    trustScore,
    biasStatus,
    summary,
    reasons: uniqueReasons,
    warnings: uniqueWarnings,
    generatedAtMs: now,
  };
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a shaped recommendation for operator review.
 */
export function formatVoiceShapedRecommendation(
  shaped: VoiceShapedRecommendation,
): string {
  const lines = [
    `🧭 Voice Trust-Aware Recommendation`,
    `• recommendation type: ${shaped.originalType}`,
    `• original confidence: ${shaped.originalConfidence}`,
    `• shaped confidence: ${shaped.shapedConfidence}`,
    `• priority: ${shaped.priority}`,
    `• trust score: ${shaped.trustScore.toFixed(2)}`,
    `• bias status: ${shaped.biasStatus}`,
    `• summary: ${shaped.summary}`,
  ];

  if (shaped.reasons.length > 0) {
    lines.push(`• reasons: ${shaped.reasons.join(", ")}`);
  }
  if (shaped.warnings.length > 0) {
    lines.push(`• warnings: ${shaped.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
