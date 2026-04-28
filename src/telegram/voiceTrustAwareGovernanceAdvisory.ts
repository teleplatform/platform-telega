/**
 * Voice Trust-Aware Governance Advisory Layer v2.0
 *
 * Enhances governance decisions with historical trust context.
 * Tells the system whether a governance decision is historically supported,
 * requires caution, or is risk-flagged based on the patch family's history.
 *
 * This layer:
 *   - reads governed apply result + shaped recommendation
 *   - produces governance advisory overlay
 *   - explains decisions via historical trust context
 *   - never mutates apply decisions or runtime state
 *
 * This layer does NOT:
 *   - change governedApply.applyDecision
 *   - change VoiceShapedRecommendation
 *   - change apply engine
 *   - auto-allow / auto-deny anything
 *   - mutate runtime config
 */

import type { VoiceGovernedApplyResult } from "./voiceGovernedApplyGate.js";
import type { VoiceShapedRecommendation } from "./voiceTrustAwareRecommendationShaping.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceGovernanceTrustAdvisoryStatus =
  | "governance_supported"
  | "governance_caution"
  | "governance_risk_flagged";

export interface VoiceTrustAwareGovernanceAdvisory {
  recommendationType: string;

  governanceAdvisoryStatus: VoiceGovernanceTrustAdvisoryStatus;

  applyDecision: "allow_apply" | "hold" | "deny";
  shapedConfidence: "low" | "medium" | "high";

  trustScore: number;
  biasStatus: "historically_supported" | "historically_uncertain" | "historically_risky";

  advisorySeverity: "low" | "medium" | "high";

  summary: string;

  reasons: string[];
  warnings: string[];

  generatedAtMs: number;
}

// ============================================================================
// Core governance advisory builder
// ============================================================================

/**
 * Build a trust-aware governance advisory from governed apply + shaped recommendation.
 * Pure function — deterministic, bounded, read-only.
 */
export function buildVoiceTrustAwareGovernanceAdvisory(
  governedApply: VoiceGovernedApplyResult,
  shapedRecommendation: VoiceShapedRecommendation,
): VoiceTrustAwareGovernanceAdvisory {
  const now = Date.now();

  const applyDecision = governedApply.applyDecision;
  const shapedConfidence = shapedRecommendation.shapedConfidence;
  const trustScore = shapedRecommendation.trustScore;
  const biasStatus = shapedRecommendation.biasStatus;
  const recommendationType = shapedRecommendation.originalType;

  let governanceAdvisoryStatus: VoiceGovernanceTrustAdvisoryStatus = "governance_caution";
  let advisorySeverity: "low" | "medium" | "high" = "medium";
  let summary = "";
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Collect reasons/warnings from inputs (deduplicated)
  const inputReasons = new Set<string>(shapedRecommendation.reasons);
  const inputWarnings = new Set<string>([...governedApply.warnings, ...shapedRecommendation.warnings]);

  // ========================================================================
  // RULE 1 — governance_supported
  // ========================================================================
  if (
    applyDecision === "allow_apply" &&
    biasStatus === "historically_supported" &&
    shapedConfidence === "high"
  ) {
    governanceAdvisoryStatus = "governance_supported";
    advisorySeverity = "low";
    summary = "Governance decision is historically supported by this patch family.";

    reasons.push("historical_trust_supports_governance_allow");
    reasons.push("high_shaped_confidence_supports_apply");

    // Inherit input reasons
    for (const r of inputReasons) reasons.push(r);
  }
  // ========================================================================
  // RULE 2 — governance_risk_flagged
  // ========================================================================
  else if (
    biasStatus === "historically_risky" ||
    applyDecision === "deny"
  ) {
    governanceAdvisoryStatus = "governance_risk_flagged";
    advisorySeverity = "high";
    summary = "Governance review is risk-flagged due to rollback-heavy or blocked historical profile.";

    warnings.push("historical_risk_flags_governance_review");

    if (applyDecision === "deny") {
      warnings.push("governance_denial_is_consistent_with_risk_profile");
    }

    // Inherit input reasons/warnings
    for (const r of inputReasons) reasons.push(r);
    for (const w of inputWarnings) warnings.push(w);
  }
  // ========================================================================
  // RULE 3 — governance_caution (default)
  // ========================================================================
  else {
    governanceAdvisoryStatus = "governance_caution";
    advisorySeverity = "medium";
    summary = "Governance decision should remain cautious due to mixed or incomplete historical trust.";

    reasons.push("historical_signal_is_mixed_for_governance");
    reasons.push("governance_should_remain_cautious");

    // Inherit input reasons/warnings
    for (const r of inputReasons) reasons.push(r);
    for (const w of inputWarnings) warnings.push(w);
  }

  // Deduplicate and sort for deterministic output
  const uniqueReasons = [...new Set(reasons)].sort();
  const uniqueWarnings = [...new Set(warnings)].sort();

  return {
    recommendationType,
    governanceAdvisoryStatus,
    applyDecision,
    shapedConfidence,
    trustScore,
    biasStatus,
    advisorySeverity,
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
 * Format a trust-aware governance advisory for operator review.
 */
export function formatVoiceTrustAwareGovernanceAdvisory(
  advisory: VoiceTrustAwareGovernanceAdvisory,
): string {
  const lines = [
    `🛡 Voice Trust-Aware Governance Advisory`,
    `• recommendation type: ${advisory.recommendationType}`,
    `• apply decision: ${advisory.applyDecision}`,
    `• advisory status: ${advisory.governanceAdvisoryStatus}`,
    `• advisory severity: ${advisory.advisorySeverity}`,
    `• shaped confidence: ${advisory.shapedConfidence}`,
    `• trust score: ${advisory.trustScore.toFixed(2)}`,
    `• bias status: ${advisory.biasStatus}`,
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
