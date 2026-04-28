/**
 * Voice Governed Apply Gate Layer v1.2
 *
 * Hard governance barrier between voice policy recommendations and runtime.
 * Ensures recommendations are only applied when safe, stable, and well-evidenced.
 *
 * This layer answers:
 *   - "Do I have the right to apply this?"
 *   - "Is the evidence strong enough?"
 *   - "Is the runtime context stable?"
 *   - "Will this cause voice regression?"
 *
 * This layer DOES NOT:
 *   - auto-apply config patches
 *   - auto-rewrite thresholds
 *   - auto-switch routing
 *   - mutate runtime state
 *
 * It ONLY provides:
 *   - gate decision (allow_apply / hold / deny)
 *   - governance output
 *   - structured logging
 */

import type {
  VoicePolicyRecommendation,
} from "./voiceAdaptivePolicyRecommendations.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceGovernedApplyDecision =
  | "allow_apply"
  | "hold"
  | "deny";

export interface VoiceGovernedApplyResult {
  applyDecision: VoiceGovernedApplyDecision;
  reason: string;
  confidence: "low" | "medium" | "high";

  blockers: string[];
  warnings: string[];

  safeApplyMode: "manual_review_only";
  generatedAtMs: number;
}

export interface EvaluateVoiceGovernedApplyInput {
  recommendation: VoicePolicyRecommendation;
  summary: {
    totalSignals: number;
    voiceSuccessRate: number;
    fallbackRate: number;
    interruptionBlockRate: number;
    avgQualityScore: number;
  };
  currentInstabilityLevel?: "low" | "medium" | "high";
  recentRecommendationFlaps?: number;
}

// ============================================================================
// Constants — governance thresholds
// ============================================================================

/** Minimum evidence window before any policy change */
const MIN_EVIDENCE_SIGNALS = 20;

/** Minimum voice success rate for stable runtime */
const MIN_STABLE_SUCCESS_RATE = 55;

/** Maximum fallback rate for stable runtime */
const MAX_STABLE_FALLBACK_RATE = 35;

/** Policy flapping threshold — too many recent changes */
const MAX_RECOMMENDATION_FLAPS = 3;

// ============================================================================
// Core governance evaluation function
// ============================================================================

/**
 * Evaluate governed apply gate for a policy recommendation.
 * Pure function — deterministic, bounded, advisory.
 */
export function evaluateVoiceGovernedApply(
  input: EvaluateVoiceGovernedApplyInput,
): VoiceGovernedApplyResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const now = Date.now();

  const rec = input.recommendation;
  const summary = input.summary;
  const instability = input.currentInstabilityLevel ?? "low";
  const flaps = input.recentRecommendationFlaps ?? 0;

  // ========================================================================
  // RULE 1 — insufficient evidence → HOLD
  // ========================================================================
  if (summary.totalSignals < MIN_EVIDENCE_SIGNALS) {
    return {
      applyDecision: "hold",
      reason: "insufficient_evidence_window",
      confidence: "low",
      blockers: ["not_enough_voice_turns"],
      warnings: [],
      safeApplyMode: "manual_review_only",
      generatedAtMs: now,
    };
  }

  // ========================================================================
  // RULE 3 — fallback spike / unstable delivery → DENY
  // Priority: deny overrides hold — active instability is a hard blocker
  // ========================================================================
  if (summary.fallbackRate > MAX_STABLE_FALLBACK_RATE || summary.voiceSuccessRate < MIN_STABLE_SUCCESS_RATE) {
    return {
      applyDecision: "deny",
      reason: "voice_runtime_unstable",
      confidence: "high",
      blockers: ["delivery_instability_detected"],
      warnings: ["apply_under_instability_is_blocked"],
      safeApplyMode: "manual_review_only",
      generatedAtMs: now,
    };
  }

  // ========================================================================
  // RULE 2 — recommendation weak confidence → HOLD
  // ========================================================================
  if (rec.confidence === "low") {
    return {
      applyDecision: "hold",
      reason: "recommendation_confidence_too_low",
      confidence: "low",
      blockers: ["weak_policy_signal"],
      warnings: [],
      safeApplyMode: "manual_review_only",
      generatedAtMs: now,
    };
  }

  // ========================================================================
  // RULE 4 — too much policy flapping → HOLD
  // ========================================================================
  if (flaps >= MAX_RECOMMENDATION_FLAPS) {
    return {
      applyDecision: "hold",
      reason: "policy_flapping_detected",
      confidence: "medium",
      blockers: ["recommendation_instability"],
      warnings: ["wait_for_stabilization_window"],
      safeApplyMode: "manual_review_only",
      generatedAtMs: now,
    };
  }

  // ========================================================================
  // Additional governance checks
  // ========================================================================

  // High system instability → HOLD
  if (instability === "high") {
    blockers.push("system_instability_high");
    warnings.push("runtime_too_unstable_for_policy_change");
  }

  // Medium instability + weak recommendation → HOLD
  if (instability === "medium" && rec.confidence === "medium") {
    blockers.push("combined_instability_and_medium_confidence");
    warnings.push("wait_for_stronger_signal_or_stability");
  }

  // If any blockers accumulated → HOLD
  if (blockers.length > 0) {
    return {
      applyDecision: "hold",
      reason: "governance_blockers_present",
      confidence: rec.confidence,
      blockers,
      warnings,
      safeApplyMode: "manual_review_only",
      generatedAtMs: now,
    };
  }

  // ========================================================================
  // RULE 5 — strong recommendation + stable runtime → ALLOW (manual review only)
  // ========================================================================
  return {
    applyDecision: "allow_apply",
    reason: "sufficient_evidence_and_stable_runtime",
    confidence: "high",
    blockers: [],
    warnings: ["manual_review_required_before_any_policy_change"],
    safeApplyMode: "manual_review_only",
    generatedAtMs: now,
  };
}

/**
 * Format a governed apply result for logging/inspection.
 */
export function formatVoiceGovernedApplyResult(
  recommendationType: string,
  result: VoiceGovernedApplyResult,
): string {
  return [
    `=== Voice Governed Apply Gate ===`,
    `Recommendation: ${recommendationType}`,
    `Apply Decision: ${result.applyDecision}`,
    `Reason: ${result.reason}`,
    `Confidence: ${result.confidence}`,
    `Blockers: ${result.blockers.length > 0 ? result.blockers.join(", ") : "(none)"}`,
    `Warnings: ${result.warnings.length > 0 ? result.warnings.join(", ") : "(none)"}`,
    `Safe Apply Mode: ${result.safeApplyMode}`,
    `Generated At: ${new Date(result.generatedAtMs).toISOString()}`,
  ].join("\n");
}
