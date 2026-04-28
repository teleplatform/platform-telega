/**
 * Voice Delivery Policy / Provider Orchestration Layer v1.0
 *
 * Bounded delivery policy — decides which delivery path to use for the current turn:
 *   fast_voice, quality_voice, or text_only.
 *
 * The best voice path is not the fanciest one. It is the one that delivers
 * the right presence with the right latency and the lowest user friction.
 *
 * This layer does NOT:
 *   - Build orchestration platforms, job schedulers, or multi-provider frameworks
 *   - Add DB / persistence / migrations
 *   - Use LLM calls or generative rewriting
 *   - Duplicate strategy / first-audio / failure recovery logic
 *   - Rewrite provider contracts or bot runtime
 *
 * It ONLY decides:
 *   - which delivery mode to use for THIS turn
 *   - which provider to route to
 *   - when to bypass quality for speed or vice versa
 *   - when text is the best surface
 */

// ============================================================================
// Domain model
// ============================================================================

export type VoiceDeliveryMode =
  | "fast_voice"
  | "quality_voice"
  | "text_only";

export type VoiceProviderChoice =
  | "say_macos"
  | "kozy"
  | "none";

export type VoiceDeliveryReasonCode =
  | "direct_fast_better"
  | "quality_voice_worth_it"
  | "reply_too_small_for_voice"
  | "reply_too_large_for_quality"
  | "fast_provider_unavailable"
  | "quality_provider_unavailable"
  | "first_audio_favors_fast"
  | "reentry_favors_fast"
  | "failure_history_bias_to_fast"
  | "text_is_best_surface";

export interface VoiceDeliveryPolicyInput {
  originalStrategyMode: "voice_quality" | "voice_fast" | "text_only";
  preferredProvider: "kozy" | null;

  textLength: number;
  answerLength?: "short" | "medium" | "long";
  taskComplexity?: "low" | "medium" | "high";

  cadenceMode?:
    | "crisp_direct"
    | "warm_compact"
    | "steady_explanatory"
    | "soft_guided"
    | "supportive_gentle";

  firstAudioMode?: "disabled" | "single_chunk_fast_start" | "full_response_only";
  reentryMode?:
    | "instant_resume"
    | "soft_return"
    | "practical_rejoin"
    | "warm_reentry"
    | "cold_reset";

  isFastProviderAvailable: boolean;
  isQualityProviderAvailable: boolean;

  recentVoiceFailure?: boolean;
}

export interface VoiceDeliveryPolicyDecision {
  deliveryMode: VoiceDeliveryMode;
  providerChoice: VoiceProviderChoice;
  reasonCode: VoiceDeliveryReasonCode;

  shouldBypassQualityPath: boolean;
  shouldPreferFastPath: boolean;
  shouldUseTextInstead: boolean;

  hints: string[];
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Text too short to justify voice delivery overhead */
const MIN_VOICE_CHARS = 10;

/** Text too long for comfortable quality voice latency */
const MAX_QUALITY_VOICE_CHARS = 500;

/** Text too long for fast voice (say command limit) */
const MAX_FAST_VOICE_CHARS = 300;

// ============================================================================
// Core decision function
// ============================================================================

/**
 * Decide voice delivery policy for the current turn.
 * Pure function — deterministic, bounded, advisory.
 */
export function decideVoiceDeliveryPolicy(
  input: VoiceDeliveryPolicyInput,
): VoiceDeliveryPolicyDecision {
  const hints: string[] = [];
  const warnings: string[] = [];

  const strategy = input.originalStrategyMode;
  const textLen = input.textLength;
  const answerLen = input.answerLength ?? "medium";
  const complexity = input.taskComplexity ?? "medium";
  const cadence = input.cadenceMode ?? "steady_explanatory";
  const firstAudio = input.firstAudioMode ?? "full_response_only";
  const reentry = input.reentryMode ?? "cold_reset";
  const fastAvailable = input.isFastProviderAvailable;
  const qualityAvailable = input.isQualityProviderAvailable;
  const recentFailure = input.recentVoiceFailure ?? false;

  // ========================================================================
  // RULE A — strategy `text_only` remains authoritative
  // ========================================================================
  if (strategy === "text_only") {
    return {
      deliveryMode: "text_only",
      providerChoice: "none",
      reasonCode: "text_is_best_surface",
      shouldBypassQualityPath: true,
      shouldPreferFastPath: false,
      shouldUseTextInstead: true,
      hints: ["text_surface_is_best_here"],
      warnings: [],
    };
  }

  // ========================================================================
  // RULE F — text too small for useful voice
  // ========================================================================
  if (textLen < MIN_VOICE_CHARS) {
    return {
      deliveryMode: "text_only",
      providerChoice: "none",
      reasonCode: "reply_too_small_for_voice",
      shouldBypassQualityPath: true,
      shouldPreferFastPath: false,
      shouldUseTextInstead: true,
      hints: ["text_surface_is_best_here"],
      warnings: ["text_better_than_forced_voice"],
    };
  }

  // ========================================================================
  // RULE F — text too large for good quality voice in current runtime
  // ========================================================================
  if (textLen > MAX_QUALITY_VOICE_CHARS && strategy === "voice_quality") {
    return {
      deliveryMode: "text_only",
      providerChoice: "none",
      reasonCode: "reply_too_large_for_quality",
      shouldBypassQualityPath: true,
      shouldPreferFastPath: false,
      shouldUseTextInstead: true,
      hints: ["text_surface_is_best_here"],
      warnings: ["oversized_turn_not_good_for_current_voice_runtime"],
    };
  }

  // ========================================================================
  // RULE B — fast path preferred for short/direct/reentry-sensitive turns
  // ========================================================================
  const isDirectCadence = cadence === "crisp_direct" || cadence === "warm_compact";
  const isShortTurn = answerLen === "short" || answerLen === "medium";
  const firstAudioFast = firstAudio === "single_chunk_fast_start";
  const reentryFast = reentry === "instant_resume" || reentry === "practical_rejoin";

  const fastPathPreferred =
    isShortTurn &&
    (isDirectCadence || firstAudioFast || reentryFast);

  // RULE E — recent failure biases toward faster safer path
  if (recentFailure && fastPathPreferred) {
    hints.push("failure_history_bias_to_fast");
  }

  // ========================================================================
  // RULE D — unavailable provider must not poison delivery decision
  // ========================================================================

  // If strategy says quality_voice
  if (strategy === "voice_quality") {
    // RULE C — quality path only when quality is actually worth the latency
    const qualityWorthIt =
      answerLen === "medium" || answerLen === "long" ||
      complexity === "medium" || complexity === "high" ||
      cadence === "steady_explanatory" ||
      cadence === "soft_guided" ||
      cadence === "supportive_gentle";

    // Fast path strongly favored by turn shape
    if (fastPathPreferred && firstAudioFast) {
      if (fastAvailable) {
        const failureHints = recentFailure ? ["failure_history_bias_to_fast"] : [];
        const reentryHints = reentryFast ? ["reentry_should_not_wait_for_slow_voice"] : [];
        return {
          deliveryMode: "fast_voice",
          providerChoice: "say_macos",
          reasonCode: "first_audio_favors_fast",
          shouldBypassQualityPath: true,
          shouldPreferFastPath: true,
          shouldUseTextInstead: false,
          hints: [
            "fast_path_best_matches_turn_shape",
            "first_audio_advantage_favors_fast",
            ...failureHints,
            ...reentryHints,
          ],
          warnings: ["quality_path_not_worth_latency_here"],
        };
      }
      // Fast unavailable, quality available
      if (qualityAvailable && qualityWorthIt) {
        return {
          deliveryMode: "quality_voice",
          providerChoice: "kozy",
          reasonCode: "quality_voice_worth_it",
          shouldBypassQualityPath: false,
          shouldPreferFastPath: false,
          shouldUseTextInstead: false,
          hints: ["quality_path_reserved_for_high-value_voice_turn"],
          warnings: ["provider_unavailable_delivery_downgraded"],
        };
      }
      // Neither available → text
      return {
        deliveryMode: "text_only",
        providerChoice: "none",
        reasonCode: "fast_provider_unavailable",
        shouldBypassQualityPath: true,
        shouldPreferFastPath: false,
        shouldUseTextInstead: true,
        hints: ["text_surface_is_best_here"],
        warnings: ["provider_unavailable_delivery_downgraded"],
      };
    }

    // Reentry favors fast — check if fast is better
    if (reentryFast && fastAvailable) {
      return {
        deliveryMode: "fast_voice",
        providerChoice: "say_macos",
        reasonCode: "reentry_favors_fast",
        shouldBypassQualityPath: true,
        shouldPreferFastPath: true,
        shouldUseTextInstead: false,
        hints: [
          "fast_path_best_matches_turn_shape",
          "reentry_should_not_wait_for_slow_voice",
        ],
        warnings: ["quality_path_not_worth_latency_here"],
      };
    }

    // Quality provider unavailable
    if (!qualityAvailable) {
      if (fastAvailable && textLen <= MAX_FAST_VOICE_CHARS) {
        return {
          deliveryMode: "fast_voice",
          providerChoice: "say_macos",
          reasonCode: "quality_provider_unavailable",
          shouldBypassQualityPath: true,
          shouldPreferFastPath: true,
          shouldUseTextInstead: false,
          hints: ["fast_path_best_matches_turn_shape"],
          warnings: ["provider_unavailable_delivery_downgraded"],
        };
      }
      return {
        deliveryMode: "text_only",
        providerChoice: "none",
        reasonCode: "quality_provider_unavailable",
        shouldBypassQualityPath: true,
        shouldPreferFastPath: false,
        shouldUseTextInstead: true,
        hints: ["text_surface_is_best_here"],
        warnings: ["provider_unavailable_delivery_downgraded"],
      };
    }

    // Quality is worth it and available
    if (qualityWorthIt) {
      return {
        deliveryMode: "quality_voice",
        providerChoice: "kozy",
        reasonCode: "quality_voice_worth_it",
        shouldBypassQualityPath: false,
        shouldPreferFastPath: false,
        shouldUseTextInstead: false,
        hints: ["quality_path_reserved_for_high-value_voice_turn"],
        warnings: [],
      };
    }

    // Quality not worth it → fast if available
    if (fastAvailable) {
      return {
        deliveryMode: "fast_voice",
        providerChoice: "say_macos",
        reasonCode: "direct_fast_better",
        shouldBypassQualityPath: true,
        shouldPreferFastPath: true,
        shouldUseTextInstead: false,
        hints: ["fast_path_best_matches_turn_shape"],
        warnings: ["quality_path_not_worth_latency_here"],
      };
    }

    // Neither fast nor quality justified
    return {
      deliveryMode: "text_only",
      providerChoice: "none",
      reasonCode: "text_is_best_surface",
      shouldBypassQualityPath: true,
      shouldPreferFastPath: false,
      shouldUseTextInstead: true,
      hints: ["text_surface_is_best_here"],
      warnings: ["text_better_than_forced_voice"],
    };
  }

  // If strategy says voice_fast
  if (strategy === "voice_fast") {
    // RULE E — recent failure bias
    if (recentFailure && !fastAvailable) {
      if (qualityAvailable) {
        return {
          deliveryMode: "quality_voice",
          providerChoice: "kozy",
          reasonCode: "fast_provider_unavailable",
          shouldBypassQualityPath: false,
          shouldPreferFastPath: false,
          shouldUseTextInstead: false,
          hints: ["quality_path_reserved_for_high-value_voice_turn"],
          warnings: [
            "provider_unavailable_delivery_downgraded",
            "recent_failure_biases_away_from_quality",
          ],
        };
      }
      return {
        deliveryMode: "text_only",
        providerChoice: "none",
        reasonCode: "fast_provider_unavailable",
        shouldBypassQualityPath: true,
        shouldPreferFastPath: false,
        shouldUseTextInstead: true,
        hints: ["text_surface_is_best_here"],
        warnings: ["provider_unavailable_delivery_downgraded"],
      };
    }

    // Normal fast path
    if (fastAvailable) {
      return {
        deliveryMode: "fast_voice",
        providerChoice: "say_macos",
        reasonCode: "direct_fast_better",
        shouldBypassQualityPath: true,
        shouldPreferFastPath: true,
        shouldUseTextInstead: false,
        hints: ["fast_path_best_matches_turn_shape"],
        warnings: [],
      };
    }

    // Fast unavailable, quality available
    if (qualityAvailable) {
      return {
        deliveryMode: "quality_voice",
        providerChoice: "kozy",
        reasonCode: "fast_provider_unavailable",
        shouldBypassQualityPath: false,
        shouldPreferFastPath: false,
        shouldUseTextInstead: false,
        hints: ["quality_path_reserved_for_high-value_voice_turn"],
        warnings: ["provider_unavailable_delivery_downgraded"],
      };
    }

    // Both unavailable → text
    return {
      deliveryMode: "text_only",
      providerChoice: "none",
      reasonCode: "fast_provider_unavailable",
      shouldBypassQualityPath: true,
      shouldPreferFastPath: false,
      shouldUseTextInstead: true,
      hints: ["text_surface_is_best_here"],
      warnings: ["provider_unavailable_delivery_downgraded"],
    };
  }

  // ========================================================================
  // Default fallback — text is best surface
  // ========================================================================
  return {
    deliveryMode: "text_only",
    providerChoice: "none",
    reasonCode: "text_is_best_surface",
    shouldBypassQualityPath: true,
    shouldPreferFastPath: false,
    shouldUseTextInstead: true,
    hints: ["text_surface_is_best_here"],
    warnings: [],
  };
}
