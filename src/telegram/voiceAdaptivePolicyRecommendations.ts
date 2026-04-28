/**
 * Voice Adaptive Policy Recommendation Layer v1.1
 *
 * Read-only advisory layer — converts collected voice execution signals
 * into evidence-based, explainable policy recommendations.
 *
 * This layer:
 *   - reads voiceAdaptiveSignals aggregates
 *   - evaluates bounded window analysis
 *   - detects sustained degradation patterns
 *   - produces policy recommendations with confidence scores
 *
 * This layer DOES NOT:
 *   - change runtime decisions
 *   - change routing or delivery mode
 *   - change thresholds or config
 *   - trigger self-tuning or auto-apply
 *   - mutate any system state
 *
 * It ONLY provides advisory recommendations for manual review
 * or future governed apply layers.
 */

// ============================================================================
// Domain model
// ============================================================================

export type VoicePolicyRecommendationType =
  | "prefer_fast_voice_for_short_replies"
  | "prefer_quality_voice_for_stable_sessions"
  | "raise_interruption_guard_sensitivity"
  | "lower_interruption_guard_sensitivity"
  | "reduce_voice_usage_when_fallback_spikes"
  | "allow_more_voice_when_success_rate_is_high"
  | "review_quality_thresholds"
  | "no_change";

export interface VoicePolicyRecommendation {
  recommendationType: VoicePolicyRecommendationType;
  confidence: "low" | "medium" | "high";
  summary: string;

  evidenceWindowSize: number;
  generatedAtMs: number;

  metrics: {
    voiceSuccessRate: number;
    fallbackRate: number;
    interruptionBlockRate: number;
    avgQualityScore: number;
    fastCount: number;
    qualityCount: number;
    avgLatencyMs: number;
  };

  reasons: string[];
  warnings: string[];
  doNotApplyAutomatically: true;
}

/** Input: aggregated metrics from voiceAdaptiveSignals */
export interface VoicePolicyRecommendationInput {
  totalSignals: number;
  voiceSuccessRate: number;
  fallbackRate: number;
  interruptionBlockRate: number;
  avgQualityScore: number;
  fastCount: number;
  qualityCount: number;
  avgLatencyMs: number;

  // Optional: per-provider latency breakdown
  avgFastProviderLatencyMs?: number;
  avgQualityProviderLatencyMs?: number;

  // Optional: stale/superseded conflict rate
  staleConflictRate?: number;
}

// ============================================================================
// Constants — evaluation thresholds
// ============================================================================

/** Minimum signals needed before making any recommendation */
const MIN_SIGNALS_FOR_RECOMMENDATION = 10;

/** Success rate threshold for "high" voice success */
const HIGH_SUCCESS_RATE_THRESHOLD = 85;

/** Fallback rate threshold for "spike" detection */
const FALLBACK_SPIKE_THRESHOLD = 30;

/** Interruption block rate considered "high" */
const HIGH_INTERRUPTION_BLOCK_RATE = 25;

/** Quality score considered "good" */
const GOOD_QUALITY_SCORE = 70;

/** Latency difference (ms) between quality and fast that justifies preference switch */
const LATENCY_JUSTIFICATION_GAP_MS = 15000;

/** Latency considered "within normal" for quality voice */
const ACCEPTABLE_QUALITY_LATENCY_MS = 40000;

/** Fallback rate considered "low" */
const LOW_FALLBACK_RATE = 15;

/** Stale conflict rate considered "high" */
const HIGH_STALE_CONFLICT_RATE = 10;

// ============================================================================
// Core evaluator function
// ============================================================================

/**
 * Evaluate voice policy recommendations from aggregated signals.
 * Pure function — deterministic, read-only, advisory.
 */
export function evaluateVoicePolicyRecommendations(
  input: VoicePolicyRecommendationInput,
): VoicePolicyRecommendation {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const now = Date.now();

  const metrics = {
    voiceSuccessRate: input.voiceSuccessRate,
    fallbackRate: input.fallbackRate,
    interruptionBlockRate: input.interruptionBlockRate,
    avgQualityScore: input.avgQualityScore,
    fastCount: input.fastCount,
    qualityCount: input.qualityCount,
    avgLatencyMs: input.avgLatencyMs,
  };

  // ========================================================================
  // Guard: insufficient signal volume
  // ========================================================================
  if (input.totalSignals < MIN_SIGNALS_FOR_RECOMMENDATION) {
    return {
      recommendationType: "no_change",
      confidence: "low",
      summary: `Insufficient signals (${input.totalSignals} < ${MIN_SIGNALS_FOR_RECOMMENDATION}). Need more data before making recommendations.`,
      evidenceWindowSize: input.totalSignals,
      generatedAtMs: now,
      metrics,
      reasons: ["insufficient_signal_volume"],
      warnings: ["need_more_data_for_reliable_recommendations"],
      doNotApplyAutomatically: true,
    };
  }

  const evidenceWindowSize = input.totalSignals;

  // ========================================================================
  // RULE 5 — fallback spike: reduce voice usage
  // Priority: high — active degradation detected
  // ========================================================================
  if (
    input.fallbackRate > FALLBACK_SPIKE_THRESHOLD &&
    input.voiceSuccessRate < HIGH_SUCCESS_RATE_THRESHOLD
  ) {
    return {
      recommendationType: "reduce_voice_usage_when_fallback_spikes",
      confidence: input.fallbackRate > 50 ? "high" : "medium",
      summary: `Fallback rate is ${input.fallbackRate}% (threshold: ${FALLBACK_SPIKE_THRESHOLD}%). Voice success rate is ${input.voiceSuccessRate}%. Consider reducing voice usage until stability improves.`,
      evidenceWindowSize,
      generatedAtMs: now,
      metrics,
      reasons: [
        "fallback_rate_exceeds_threshold",
        "voice_success_rate_below_target",
        "voice_path_showing_degradation",
      ],
      warnings: [
        "high_fallback_rate_indicates_provider_issues",
        "quality_thresholds_may_need_review",
      ],
      doNotApplyAutomatically: true,
    };
  }

  // ========================================================================
  // RULE 3 — interruption guard too strict
  // ========================================================================
  if (
    input.interruptionBlockRate > HIGH_INTERRUPTION_BLOCK_RATE &&
    (input.staleConflictRate ?? 0) < HIGH_STALE_CONFLICT_RATE
  ) {
    return {
      recommendationType: "lower_interruption_guard_sensitivity",
      confidence: input.interruptionBlockRate > 40 ? "high" : "medium",
      summary: `Interruption block rate is ${input.interruptionBlockRate}% but actual stale conflicts are rare (${input.staleConflictRate ?? 0}%). Guard may be too aggressive, blocking valid voice sends.`,
      evidenceWindowSize,
      generatedAtMs: now,
      metrics,
      reasons: [
        "interruption_block_rate_high",
        "stale_conflicts_actually_rare",
        "guard_may_be_overly_conservative",
      ],
      warnings: [
        "reducing_sensitivity_could_increase_stale_voice_risk",
        "review_interruption_logic_carefully",
      ],
      doNotApplyAutomatically: true,
    };
  }

  // ========================================================================
  // RULE 4 — interruption guard too weak
  // ========================================================================
  if (
    (input.staleConflictRate ?? 0) > HIGH_STALE_CONFLICT_RATE &&
    input.interruptionBlockRate < HIGH_INTERRUPTION_BLOCK_RATE
  ) {
    return {
      recommendationType: "raise_interruption_guard_sensitivity",
      confidence: input.staleConflictRate != null && input.staleConflictRate > 20 ? "high" : "medium",
      summary: `Stale conflict rate is ${input.staleConflictRate ?? 0}% (threshold: ${HIGH_STALE_CONFLICT_RATE}%). Stale voice is getting through — interruption guard may need tightening.`,
      evidenceWindowSize,
      generatedAtMs: now,
      metrics,
      reasons: [
        "stale_conflict_rate_above_threshold",
        "stale_voice_reaching_users",
        "interruption_guard_insufficient",
      ],
      warnings: [
        "raising_sensitivity_would_block_more_voice_sends",
        "balance_against_false_positive_risk",
      ],
      doNotApplyAutomatically: true,
    };
  }

  // ========================================================================
  // RULE 1 — prefer fast voice for short replies
  // ========================================================================
  const fastLatency = input.avgFastProviderLatencyMs ?? 3000;
  const qualityLatency = input.avgQualityProviderLatencyMs ?? 35000;
  const latencyGap = qualityLatency - fastLatency;

  if (
    input.fastCount > input.qualityCount &&
    latencyGap > LATENCY_JUSTIFICATION_GAP_MS &&
    input.fallbackRate < LOW_FALLBACK_RATE &&
    input.voiceSuccessRate >= HIGH_SUCCESS_RATE_THRESHOLD * 0.9
  ) {
    return {
      recommendationType: "prefer_fast_voice_for_short_replies",
      confidence: latencyGap > 25000 ? "high" : "medium",
      summary: `Fast voice (${fastLatency}ms) is ${latencyGap}ms faster than quality (${qualityLatency}ms) with comparable success. For short replies, fast voice may be the better product choice.`,
      evidenceWindowSize,
      generatedAtMs: now,
      metrics,
      reasons: [
        "fast_voice_significantly_lower_latency",
        "fast_success_rate_comparable",
        "fallback_not_increasing",
        "short_replies_benefit_from_speed",
      ],
      warnings: [
        "fast_voice_quality_is_lower_than_quality_voice",
        "apply_selectively_for_short_replies_only",
      ],
      doNotApplyAutomatically: true,
    };
  }

  // ========================================================================
  // RULE 2 — prefer quality voice for stable sessions
  // ========================================================================
  if (
    input.qualityCount > 0 &&
    input.avgQualityScore > GOOD_QUALITY_SCORE &&
    input.interruptionBlockRate < 10 &&
    qualityLatency < ACCEPTABLE_QUALITY_LATENCY_MS &&
    input.voiceSuccessRate >= HIGH_SUCCESS_RATE_THRESHOLD
  ) {
    return {
      recommendationType: "prefer_quality_voice_for_stable_sessions",
      confidence: input.avgQualityScore > 80 ? "high" : "medium",
      summary: `Quality voice shows high quality score (${input.avgQualityScore}), low interruption rate (${input.interruptionBlockRate}%), and good success rate (${input.voiceSuccessRate}%). Quality path is stable and worth expanding.`,
      evidenceWindowSize,
      generatedAtMs: now,
      metrics,
      reasons: [
        "quality_voice_quality_score_high",
        "interruption_rate_low",
        "latency_within_acceptable_range",
        "success_rate_strong",
      ],
      warnings: [
        "quality_voice_latency_grows_with_text_length",
        "monitor_for_degradation_as_volume_increases",
      ],
      doNotApplyAutomatically: true,
    };
  }

  // ========================================================================
  // RULE 6 — allow more voice when success rate is high
  // ========================================================================
  if (
    input.voiceSuccessRate >= HIGH_SUCCESS_RATE_THRESHOLD &&
    input.fallbackRate < LOW_FALLBACK_RATE &&
    input.interruptionBlockRate < HIGH_INTERRUPTION_BLOCK_RATE
  ) {
    return {
      recommendationType: "allow_more_voice_when_success_rate_is_high",
      confidence: "high",
      summary: `Voice success rate is ${input.voiceSuccessRate}% with only ${input.fallbackRate}% fallback. System is healthy — safe to consider expanding voice usage.`,
      evidenceWindowSize,
      generatedAtMs: now,
      metrics,
      reasons: [
        "voice_success_rate_exceeds_target",
        "fallback_rate_within_tolerance",
        "interruption_rate_acceptable",
        "system_health_strong",
      ],
      warnings: [
        "expand_gradually_and_monitor",
        "do_not_remove_safety_guards",
      ],
      doNotApplyAutomatically: true,
    };
  }

  // ========================================================================
  // Default — no actionable recommendation
  // ========================================================================
  if (input.avgQualityScore < GOOD_QUALITY_SCORE * 0.7) {
    return {
      recommendationType: "review_quality_thresholds",
      confidence: "low",
      summary: `Average quality score is ${input.avgQualityScore} — below healthy threshold. Review admission scoring thresholds and text shaping rules.`,
      evidenceWindowSize,
      generatedAtMs: now,
      metrics,
      reasons: [
        "average_quality_score_below_healthy_level",
        "admission_scoring_may_need_adjustment",
      ],
      warnings: [
        "low_quality_may_indicate_pipeline_issues",
        "check_assembly_and_smoothing_layers",
      ],
      doNotApplyAutomatically: true,
    };
  }

  return {
    recommendationType: "no_change",
    confidence: "medium",
    summary: `No strong recommendation signals detected. System metrics: success=${input.voiceSuccessRate}%, fallback=${input.fallbackRate}%, quality=${input.avgQualityScore}.`,
    evidenceWindowSize,
    generatedAtMs: now,
    metrics,
    reasons: ["metrics_within_acceptable_ranges"],
    warnings: ["continue_monitoring"],
    doNotApplyAutomatically: true,
  };
}

/**
 * Format a recommendation for logging/inspection.
 */
export function formatVoicePolicyRecommendation(
  rec: VoicePolicyRecommendation,
): string {
  return [
    `=== Voice Policy Recommendation ===`,
    `Type: ${rec.recommendationType}`,
    `Confidence: ${rec.confidence}`,
    `Summary: ${rec.summary}`,
    `Evidence Window: ${rec.evidenceWindowSize} turns`,
    `Metrics:`,
    `  voiceSuccessRate: ${rec.metrics.voiceSuccessRate}%`,
    `  fallbackRate: ${rec.metrics.fallbackRate}%`,
    `  interruptionBlockRate: ${rec.metrics.interruptionBlockRate}%`,
    `  avgQualityScore: ${rec.metrics.avgQualityScore}`,
    `  fastVoice: ${rec.metrics.fastCount}, qualityVoice: ${rec.metrics.qualityCount}`,
    `  avgLatencyMs: ${rec.metrics.avgLatencyMs}`,
    `Reasons: ${rec.reasons.join(", ")}`,
    `Warnings: ${rec.warnings.join(", ")}`,
    `Auto-apply: ${rec.doNotApplyAutomatically ? "NO (advisory only)" : "YES"}`,
  ].join("\n");
}
