/**
 * Voice Historical Trust Scoring Layer v1.7
 *
 * Converts patch history memory into numerical trust scores per recommendationType.
 * Classifies patch families as trusted, neutral, or risky based on historical outcomes.
 *
 * This layer:
 *   - reads from voicePatchHistoryMemory (read-only)
 *   - computes deterministic trust scores (0.00–1.00)
 *   - classifies patch families: trusted / neutral / risky
 *   - builds aggregated trust summary
 *   - provides human-readable formatters
 *
 * This layer does NOT:
 *   - change recommendation confidence
 *   - change apply decisions
 *   - mutate runtime config
 *   - add DB / ML / external dependencies
 *   - self-modify behavior
 */

import {
  getVoicePatchHistorySummary,
  getRecentVoicePatchHistory,
} from "./voicePatchHistoryMemory.js";
import type { VoicePatchHistoryEntry } from "./voicePatchHistoryMemory.js";

// ============================================================================
// Domain model
// ============================================================================

export interface VoicePatchTrustScore {
  recommendationType: string;

  trustScore: number; // 0.00 - 1.00
  confidence: "low" | "medium" | "high";

  totalSamples: number;
  confirmedCount: number;
  rolledBackCount: number;
  inconclusiveCount: number;

  status: "trusted" | "neutral" | "risky";

  reasons: string[];
  warnings: string[];
}

export interface VoiceHistoricalTrustSummary {
  totalTrackedPatchTypes: number;

  trustedPatchTypes: string[];
  riskyPatchTypes: string[];
  neutralPatchTypes: string[];

  topTrustedScores: VoicePatchTrustScore[];
  topRiskyScores: VoicePatchTrustScore[];

  generatedAtMs: number;
}

// ============================================================================
// Trust score computation
// ============================================================================

/**
 * Compute trust score for a given recommendationType.
 * Pure function — deterministic, bounded.
 */
export function getVoicePatchTrustScore(
  recommendationType: string,
): VoicePatchTrustScore {
  const history = getAllPatchHistory();

  // Filter entries for this recommendationType
  const relevantEntries = history.filter(
    (e) => e.recommendationType === recommendationType,
  );

  const totalSamples = relevantEntries.length;

  // Zero-state: no history available
  if (totalSamples === 0) {
    return {
      recommendationType,
      trustScore: 0,
      confidence: "low",
      totalSamples: 0,
      confirmedCount: 0,
      rolledBackCount: 0,
      inconclusiveCount: 0,
      status: "neutral",
      reasons: [],
      warnings: ["no_history_available"],
    };
  }

  const confirmedCount = relevantEntries.filter((e) => e.outcome === "confirmed").length;
  const rolledBackCount = relevantEntries.filter((e) => e.outcome === "rolled_back").length;
  const inconclusiveCount = relevantEntries.filter((e) => e.outcome === "inconclusive").length;

  // Bounded deterministic formula
  let trustScore = (confirmedCount * 1.0 + inconclusiveCount * 0.4) / totalSamples;
  trustScore = trustScore - (rolledBackCount / totalSamples) * 0.6;
  trustScore = Math.max(0, Math.min(1, trustScore));

  // Round to 2 decimals for consistency
  trustScore = Math.round(trustScore * 100) / 100;

  // Classification
  let status: "trusted" | "neutral" | "risky" = "neutral";
  if (totalSamples >= 2 && trustScore >= 0.70) {
    status = "trusted";
  } else if (totalSamples >= 2 && trustScore <= 0.35) {
    status = "risky";
  }

  // Confidence by sample size
  let confidence: "low" | "medium" | "high" = "low";
  if (totalSamples >= 5) {
    confidence = "high";
  } else if (totalSamples >= 3) {
    confidence = "medium";
  }

  // Reasons and warnings
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (status === "trusted") {
    reasons.push("historically_confirmed_patch_family");
    if (rolledBackCount === 0) {
      reasons.push("rollback_rate_low");
    }
    if (totalSamples >= 5) {
      reasons.push("strong_sample_volume");
    }
  } else if (status === "risky") {
    reasons.push("rollback_history_dominant");
    warnings.push("patch_family_is_unstable");
  } else {
    reasons.push("historical_signal_is_mixed");
  }

  if (rolledBackCount > 0) {
    warnings.push("rollback_history_present");
  }
  if (totalSamples < 3) {
    warnings.push("low_sample_volume");
  }

  return {
    recommendationType,
    trustScore,
    confidence,
    totalSamples,
    confirmedCount,
    rolledBackCount,
    inconclusiveCount,
    status,
    reasons,
    warnings,
  };
}

/**
 * Get trust scores for all unique recommendationTypes in patch history.
 * Returns deterministically sorted list.
 */
export function getAllVoicePatchTrustScores(): VoicePatchTrustScore[] {
  const history = getAllPatchHistory();

  // Collect unique recommendationTypes
  const types = new Set<string>();
  for (const entry of history) {
    if (entry.recommendationType) {
      types.add(entry.recommendationType);
    }
  }

  const scores: VoicePatchTrustScore[] = [];
  for (const type of types) {
    scores.push(getVoicePatchTrustScore(type));
  }

  // Deterministic sort:
  // 1. trustScore descending
  // 2. totalSamples descending
  // 3. recommendationType alphabetical
  scores.sort((a, b) => {
    if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
    if (b.totalSamples !== a.totalSamples) return b.totalSamples - a.totalSamples;
    return a.recommendationType.localeCompare(b.recommendationType);
  });

  return scores;
}

/**
 * Get aggregated historical trust summary.
 */
export function getVoiceHistoricalTrustSummary(): VoiceHistoricalTrustSummary {
  const allScores = getAllVoicePatchTrustScores();

  const trustedPatchTypes = allScores
    .filter((s) => s.status === "trusted")
    .map((s) => s.recommendationType);

  const riskyPatchTypes = allScores
    .filter((s) => s.status === "risky")
    .map((s) => s.recommendationType);

  const neutralPatchTypes = allScores
    .filter((s) => s.status === "neutral")
    .map((s) => s.recommendationType);

  // Top trusted: max 3, sorted by highest trust
  const topTrustedScores = allScores
    .filter((s) => s.status === "trusted")
    .slice(0, 3);

  // Top risky: max 3, sorted by lowest trust
  const topRiskyScores = allScores
    .filter((s) => s.status === "risky")
    .slice(0, 3);

  return {
    totalTrackedPatchTypes: allScores.length,
    trustedPatchTypes,
    riskyPatchTypes,
    neutralPatchTypes,
    topTrustedScores,
    topRiskyScores,
    generatedAtMs: Date.now(),
  };
}

// ============================================================================
// Formatters
// ============================================================================

/**
 * Format a single patch trust score for operator review.
 */
export function formatVoicePatchTrustScore(score: VoicePatchTrustScore): string {
  const lines = [
    `🧠 Voice Patch Trust Score`,
    `• recommendation type: ${score.recommendationType}`,
    `• trust score: ${score.trustScore.toFixed(2)}`,
    `• status: ${score.status}`,
    `• confidence: ${score.confidence}`,
    `• samples: ${score.totalSamples}`,
    `• confirmed: ${score.confirmedCount}`,
    `• rolled back: ${score.rolledBackCount}`,
    `• inconclusive: ${score.inconclusiveCount}`,
  ];

  if (score.reasons.length > 0) {
    lines.push(`• reasons: ${score.reasons.join(", ")}`);
  }
  if (score.warnings.length > 0) {
    lines.push(`• warnings: ${score.warnings.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Format the full historical trust summary for operator review.
 */
export function formatVoiceHistoricalTrustSummary(
  summary: VoiceHistoricalTrustSummary,
): string {
  const lines = [
    `🧠 Voice Historical Trust Summary`,
    `• tracked patch types: ${summary.totalTrackedPatchTypes}`,
    `• trusted: ${summary.trustedPatchTypes.length > 0 ? summary.trustedPatchTypes.join(", ") : "(none)"}`,
    `• risky: ${summary.riskyPatchTypes.length > 0 ? summary.riskyPatchTypes.join(", ") : "(none)"}`,
    `• neutral: ${summary.neutralPatchTypes.length > 0 ? summary.neutralPatchTypes.join(", ") : "(none)"}`,
  ];

  if (summary.topTrustedScores.length > 0) {
    const trustedList = summary.topTrustedScores
      .map((s) => `${s.recommendationType} (${s.trustScore.toFixed(2)})`)
      .join(", ");
    lines.push(`• top trusted: ${trustedList}`);
  }

  if (summary.topRiskyScores.length > 0) {
    const riskyList = summary.topRiskyScores
      .map((s) => `${s.recommendationType} (${s.trustScore.toFixed(2)})`)
      .join(", ");
    lines.push(`• top risky: ${riskyList}`);
  }

  return lines.join("\n");
}

// ============================================================================
// Read-only accessor for patch history
// ============================================================================

/**
 * Get all patch history entries (read-only).
 * Uses existing getRecentVoicePatchHistory with large limit.
 */
function getAllPatchHistory(): VoicePatchHistoryEntry[] {
  return getRecentVoicePatchHistory(9999);
}
