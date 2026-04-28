/**
 * Voice Failure Recovery / Fallback Continuity Layer v1.0
 *
 * Bounded deterministic recovery policy — regulates how the voice pipeline
 * transitions into fallback without destroying presence.
 *
 * When voice fails, presence must degrade gracefully — not collapse.
 *
 * This layer does NOT:
 *   - Build retry platforms, job queues, or streaming recovery engines
 *   - Add DB / persistence / migrations
 *   - Use LLM calls or generative rewriting
 *   - Duplicate interruption / first-audio / continuity memory logic
 *   - Create new provider abstraction layers
 *   - Inject apology text or technical error explanations
 *
 * It ONLY decides:
 *   - which fallback mode to apply
 *   - whether to preserve continuity tone in text
 *   - when to silently abort (stale / superseded voice)
 *   - when failure surface must stay quiet
 */

// ============================================================================
// Domain model
// ============================================================================

export type VoiceFailureMode =
  | "provider_error"
  | "synthesis_timeout"
  | "audio_missing"
  | "audio_too_small"
  | "stale_cancelled"
  | "quality_degraded"
  | "unknown_failure";

export type VoiceFallbackMode =
  | "clean_text_fallback"
  | "continuity_preserving_text_fallback"
  | "silent_abort";

export interface VoiceFailureRecoveryInput {
  failureMode: VoiceFailureMode;

  responseStyle?: "warm" | "supportive" | "concise" | "neutral";
  presenceMode?: "fresh" | "continuing" | "soft_followup" | "reset";
  cadenceMode?:
    | "crisp_direct"
    | "warm_compact"
    | "steady_explanatory"
    | "soft_guided"
    | "supportive_gentle";
  reentryMode?:
    | "instant_resume"
    | "soft_return"
    | "practical_rejoin"
    | "warm_reentry"
    | "cold_reset";

  isVoiceStillCurrent: boolean;
  isSuperseded: boolean;
  fallbackText: string;
}

export interface VoiceFailureRecoveryDecision {
  fallbackMode: VoiceFallbackMode;

  shouldSendTextFallback: boolean;
  shouldPreserveContinuityTone: boolean;
  shouldStoreContinuitySnapshot: boolean;
  shouldSuppressFailureSurface: boolean;

  finalFallbackText: string | null;

  hints: string[];
  warnings: string[];
}

// ============================================================================
// Fallback text shaping — bounded, meaning-preserving
// ============================================================================

/**
 * Shape fallback text for continuity preservation.
 *
 * Allowed:
 *   - soften only if current context already justified it
 *   - compact if direct
 *   - preserve current response meaning
 *   - no new content
 *
 * Forbidden:
 *   - apology injection
 *   - technical explanation
 *   - emotional over-compensation
 */
export function shapeFallbackTextForContinuity(
  text: string,
  input: VoiceFailureRecoveryInput,
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const style = input.responseStyle ?? "neutral";
  const cadence = input.cadenceMode;
  const reentry = input.reentryMode;
  const MAX_CHARS = 300;

  // RULE: direct/concise contexts — keep text clean, no softening
  if (style === "concise" || cadence === "crisp_direct") {
    return trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS - 3).trim() + "…" : trimmed;
  }

  // RULE: warm/supportive — preserve meaning, ensure clean ending
  if (style === "warm" || style === "supportive") {
    let result = trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS - 3).trim() + "…" : trimmed;
    if (!/[.!?…]$/.test(result)) {
      result += ".";
    }
    return result;
  }

  // RULE: reset / cold reentry — no soft continuity wording
  if (reentry === "cold_reset") {
    return trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS - 3).trim() + "…" : trimmed;
  }

  // RULE: practical_rejoin — clean text, no padding
  if (reentry === "practical_rejoin") {
    return trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS - 3).trim() + "…" : trimmed;
  }

  // Default: return text as-is with safe truncation
  return trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS - 3).trim() + "…" : trimmed;
}

// ============================================================================
// Core decision function
// ============================================================================

/**
 * Decide voice failure recovery behavior.
 * Pure function — deterministic, bounded, advisory.
 */
export function decideVoiceFailureRecovery(
  input: VoiceFailureRecoveryInput,
): VoiceFailureRecoveryDecision {
  const hints: string[] = [];
  const warnings: string[] = [];

  const failureMode = input.failureMode;
  const style = input.responseStyle ?? "neutral";
  const presenceMode = input.presenceMode ?? "fresh";
  const cadence = input.cadenceMode;
  const reentry = input.reentryMode;
  const isCurrent = input.isVoiceStillCurrent;
  const isSuperseded = input.isSuperseded;
  const fallbackText = input.fallbackText;

  // ========================================================================
  // RULE A — stale / superseded voice must not fall back noisily
  // ========================================================================
  if (isSuperseded || failureMode === "stale_cancelled") {
    return {
      fallbackMode: "silent_abort",
      shouldSendTextFallback: false,
      shouldPreserveContinuityTone: false,
      shouldStoreContinuitySnapshot: false,
      shouldSuppressFailureSurface: true,
      finalFallbackText: null,
      hints: ["stale_voice_should_disappear_quietly"],
      warnings: ["stale_voice_must_not_fallback_to_text"],
    };
  }

  // ========================================================================
  // RULE F — failure surface must stay quiet (applies to all paths)
  // No apology injection, no technical explanation
  // ========================================================================
  const shouldSuppressFailureSurface = true;

  // ========================================================================
  // RULE B — real provider failure may fall back to text
  // ========================================================================
  // Use explicit check with wider type
  // Compare modes - use explicit comparison to satisfy TypeScript strict narrowing
  const compareMode = failureMode as string;
  const notCancelled = compareMode !== "stale_cancelled";
  if (
    isCurrent &&
    notCancelled &&
    fallbackText &&
    fallbackText.trim().length > 0
  ) {
    // Reset / cold reentry blocks warm fallback — check FIRST
    if (presenceMode === "reset" || reentry === "cold_reset") {
      const shapedText = shapeFallbackTextForContinuity(fallbackText, input);
      return {
        fallbackMode: "clean_text_fallback",
        shouldSendTextFallback: true,
        shouldPreserveContinuityTone: false,
        shouldStoreContinuitySnapshot: false,
        shouldSuppressFailureSurface: true,
        finalFallbackText: shapedText,
        hints: [
          "direct_context_prefers_clean_degradation",
          "current_turn_allows_clean_text_fallback",
        ],
        warnings: [
          "reset_context_blocks_soft_fallback",
          "provider_failure_degraded_to_text",
        ],
      };
    }

    // RULE D — direct/concise contexts should degrade cleanly
    if (style === "concise" || cadence === "crisp_direct") {
      const shapedText = shapeFallbackTextForContinuity(fallbackText, input);
      return {
        fallbackMode: "clean_text_fallback",
        shouldSendTextFallback: true,
        shouldPreserveContinuityTone: false,
        shouldStoreContinuitySnapshot: false,
        shouldSuppressFailureSurface: true,
        finalFallbackText: shapedText,
        hints: [
          "direct_context_prefers_clean_degradation",
          "current_turn_allows_clean_text_fallback",
        ],
        warnings: [
          "provider_failure_degraded_to_text",
        ],
      };
    }

    // RULE C — warm/supportive/continuing contexts may preserve bounded continuity
    if (
      (style === "warm" || style === "supportive") &&
      presenceMode !== "fresh"
    ) {
      const shapedText = shapeFallbackTextForContinuity(fallbackText, input);
      return {
        fallbackMode: "continuity_preserving_text_fallback",
        shouldSendTextFallback: true,
        shouldPreserveContinuityTone: true,
        shouldStoreContinuitySnapshot: false,
        shouldSuppressFailureSurface: true,
        finalFallbackText: shapedText,
        hints: [
          "warm_continuity_can_be_preserved_in_text",
          "fallback_surface_kept_non_disruptive",
        ],
        warnings: [
          "voice_delivery_failed_before_completion",
          "continuity_memory_not_stored_for_failed_voice",
        ],
      };
    }

    // Default for current valid turns — clean text fallback
    const shapedText = shapeFallbackTextForContinuity(fallbackText, input);
    return {
      fallbackMode: "clean_text_fallback",
      shouldSendTextFallback: true,
      shouldPreserveContinuityTone: false,
      shouldStoreContinuitySnapshot: false,
      shouldSuppressFailureSurface: true,
      finalFallbackText: shapedText,
      hints: [
        "current_turn_allows_clean_text_fallback",
        "fallback_surface_kept_non_disruptive",
      ],
      warnings: [
        "provider_failure_degraded_to_text",
        "voice_delivery_failed_before_completion",
      ],
    };
  }

  // ========================================================================
  // RULE E — do not store continuity on broken voice unless delivery
  // still represents current turn well
  // ========================================================================
  // If we get here, voice failed before send or text is empty → no continuity
  return {
    fallbackMode: "silent_abort",
    shouldSendTextFallback: false,
    shouldPreserveContinuityTone: false,
    shouldStoreContinuitySnapshot: false,
    shouldSuppressFailureSurface: true,
    finalFallbackText: null,
    hints: ["stale_voice_should_disappear_quietly"],
    warnings: [
      "voice_delivery_failed_before_completion",
      "continuity_memory_not_stored_for_failed_voice",
    ],
  };
}
