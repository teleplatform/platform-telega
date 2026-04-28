/**
 * Voice Session Re-Entry Layer v1.0
 *
 * Bounded session re-entry decision — determines how Arisha returns to a voice
 * conversation after a pause, interruption, or silence gap.
 *
 * This layer does NOT:
 *   - Build relationship systems or long-term memory
 *   - Add DB / persistence / migrations
 *   - Use LLM calls, embeddings, or semantic retrieval
 *   - Create emotional over-carry or fake familiarity
 *   - Duplicate voicePresence, voiceContinuityMemory, or voiceTurnSmoothing
 *
 * It ONLY decides: how to re-enter the voice turn based on elapsed time,
 * continuity state, and current input shape.
 */

// ============================================================================
// Domain model
// ============================================================================

export type VoiceReentryMode =
  | "instant_resume"
  | "soft_return"
  | "practical_rejoin"
  | "warm_reentry"
  | "cold_reset";

export interface VoiceSessionReentryInput {
  chatId: string | number;
  nowMs?: number;

  inputText: string;

  presenceMode?: "fresh" | "continuing" | "soft_followup" | "reset";
  responseStyle?: "warm" | "supportive" | "concise" | "neutral";

  cadenceMode?:
    | "crisp_direct"
    | "warm_compact"
    | "steady_explanatory"
    | "soft_guided"
    | "supportive_gentle";

  isFollowUp?: boolean;
  continuityCarryMode?: "inherit_recent" | "soft_reset" | "hard_reset";
  lastVoiceAtMs?: number | null;
}

export interface VoiceSessionReentryDecision {
  reentryMode: VoiceReentryMode;

  allowWarmReentry: boolean;
  allowContinuityWording: boolean;
  shouldCleanStart: boolean;
  shouldAvoidAssumedContinuity: boolean;
  shouldBiasTowardFreshOpening: boolean;

  hints: string[];
  warnings: string[];
}

// ============================================================================
// Time constants
// ============================================================================

/** Very short pause — can resume as if no gap */
export const INSTANT_RESUME_WINDOW_MS = 90 * 1000; // 90 seconds

/** Short pause — soft return allowed */
export const SOFT_RETURN_WINDOW_MS = 8 * 60 * 1000; // 8 minutes

/** Medium pause — practical rejoin, no continuity wording */
export const PRACTICAL_REJOIN_WINDOW_MS = 35 * 60 * 1000; // 35 minutes

// ============================================================================
// Text signal heuristics — bounded, no ML, no LLM
// ============================================================================

/** Detect very short / direct / command-like input */
export function isDirectShortInput(text: string): boolean {
  const trimmed = text.trim();

  // Length check — very short
  if (trimmed.length > 40) return false;

  // Direct / command-like patterns
  const directPatterns = [
    /^(да|нет|ок|ok|ладно|ясно|ага|угу|ну|дальше|продолжай|делай|го|давай)/iu,
    /^(yes|no|ok|go|next|continue|do it)/i,
    /^(\/\w+)$/, // command
  ];

  for (const pattern of directPatterns) {
    if (pattern.test(trimmed)) return true;
  }

  // Short word count (1-2 words) without question marks
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && !/\?/.test(trimmed)) {
    return true;
  }

  return false;
}

/** Detect soft / human / follow-up-like input */
export function isSoftFollowupLikeInput(text: string): boolean {
  const trimmed = text.trim();

  // Too short to be soft follow-up
  if (trimmed.length < 10) return false;

  const softPatterns = [
    /(спасибо|благодарю|хорошо|понял|ясно|ладно|отлично|супер|класс)/iu,
    /(давай|давайте|расскажи|продолжим|что дальше|как дальше)/iu,
    /(спасибо за|я понимаю|я соглас|хорошо что|рад слышать)/iu,
    /(thank|thanks|great|okay|let's|let us|sounds good)/i,
  ];

  for (const pattern of softPatterns) {
    if (pattern.test(trimmed)) return true;
  }

  return false;
}

/** Normalize time gap; returns null if no prior voice turn timestamp */
export function normalizeGap(nowMs: number, lastVoiceAtMs?: number | null): number | null {
  if (lastVoiceAtMs == null || lastVoiceAtMs <= 0) return null;
  const gap = nowMs - lastVoiceAtMs;
  if (gap < 0) return null; // clock skew guard
  return gap;
}

// ============================================================================
// Core decision function
// ============================================================================

/**
 * Decide session re-entry mode for the next voice turn.
 * Pure function — deterministic, bounded, advisory.
 */
export function decideVoiceSessionReentry(
  input: VoiceSessionReentryInput,
): VoiceSessionReentryDecision {
  const now = input.nowMs ?? Date.now();
  const hints: string[] = [];
  const warnings: string[] = [];

  // --- Compute gap ---
  const gapMs = normalizeGap(now, input.lastVoiceAtMs);
  const presenceMode = input.presenceMode ?? "fresh";
  const responseStyle = input.responseStyle ?? "neutral";
  const continuityCarry = input.continuityCarryMode ?? "hard_reset";
  const isFollowUp = input.isFollowUp ?? false;
  const isDirect = isDirectShortInput(input.inputText);
  const isSoftFollowup = isSoftFollowupLikeInput(input.inputText);

  // --- No gap data → unknown → bias fresh ---
  if (gapMs === null) {
    return {
      reentryMode: "cold_reset",
      allowWarmReentry: false,
      allowContinuityWording: false,
      shouldCleanStart: true,
      shouldAvoidAssumedContinuity: true,
      shouldBiasTowardFreshOpening: true,
      hints: [],
      warnings: ["long_gap_requires_clean_return"],
    };
  }

  // --- RULE E — reset presence blocks continuity ---
  if (presenceMode === "reset") {
    return {
      reentryMode: "cold_reset",
      allowWarmReentry: false,
      allowContinuityWording: false,
      shouldCleanStart: true,
      shouldAvoidAssumedContinuity: true,
      shouldBiasTowardFreshOpening: true,
      hints: [],
      warnings: ["reset_presence_blocks_continuity_wording"],
    };
  }

  // --- Continuity hard_reset also forces cold reset ---
  if (continuityCarry === "hard_reset" && gapMs > SOFT_RETURN_WINDOW_MS) {
    return {
      reentryMode: "cold_reset",
      allowWarmReentry: false,
      allowContinuityWording: false,
      shouldCleanStart: true,
      shouldAvoidAssumedContinuity: true,
      shouldBiasTowardFreshOpening: true,
      hints: [],
      warnings: ["continuity_stale_for_warm_reentry", "long_gap_requires_clean_return"],
    };
  }

  // --- RULE F — direct short input suppresses soft re-entry ---
  if (isDirect) {
    if (gapMs <= INSTANT_RESUME_WINDOW_MS) {
      return {
        reentryMode: "instant_resume",
        allowWarmReentry: false,
        allowContinuityWording: true,
        shouldCleanStart: false,
        shouldAvoidAssumedContinuity: false,
        shouldBiasTowardFreshOpening: false,
        hints: ["recent_reentry_can_feel_continuous"],
        warnings: ["direct_input_suppresses_soft_reentry"],
      };
    }

    // Direct input + any gap → practical rejoin (no warmth)
    return {
      reentryMode: "practical_rejoin",
      allowWarmReentry: false,
      allowContinuityWording: false,
      shouldCleanStart: true,
      shouldAvoidAssumedContinuity: false,
      shouldBiasTowardFreshOpening: false,
      hints: ["practical_rejoin_preferred"],
      warnings: ["direct_input_suppresses_soft_reentry"],
    };
  }

  // --- RULE A — very short pause → instant resume ---
  if (gapMs <= INSTANT_RESUME_WINDOW_MS) {
    const isContinuing = presenceMode === "continuing" || presenceMode === "soft_followup";

    if (isContinuing || isFollowUp) {
      return {
        reentryMode: "instant_resume",
        allowWarmReentry: true,
        allowContinuityWording: true,
        shouldCleanStart: false,
        shouldAvoidAssumedContinuity: false,
        shouldBiasTowardFreshOpening: false,
        hints: ["recent_reentry_can_feel_continuous", "soft_return_allowed"],
        warnings: [],
      };
    }

    // Not continuing but gap is very short — still soft return
    return {
      reentryMode: "instant_resume",
      allowWarmReentry: true,
      allowContinuityWording: true,
      shouldCleanStart: false,
      shouldAvoidAssumedContinuity: false,
      shouldBiasTowardFreshOpening: false,
      hints: ["recent_reentry_can_feel_continuous"],
      warnings: [],
    };
  }

  // --- RULE E — warm reentry: only when context supports it ---
  if (
    gapMs <= SOFT_RETURN_WINDOW_MS &&
    (responseStyle === "warm" || responseStyle === "supportive") &&
    isSoftFollowup &&
    (presenceMode === "continuing" || presenceMode === "soft_followup") &&
    continuityCarry !== "hard_reset"
  ) {
    return {
      reentryMode: "warm_reentry",
      allowWarmReentry: true,
      allowContinuityWording: true,
      shouldCleanStart: false,
      shouldAvoidAssumedContinuity: false,
      shouldBiasTowardFreshOpening: false,
      hints: ["warm_reentry_allowed_short_term", "soft_return_allowed"],
      warnings: [],
    };
  }

  // --- RULE B — short recent pause → soft return ---
  if (gapMs <= SOFT_RETURN_WINDOW_MS) {
    return {
      reentryMode: "soft_return",
      allowWarmReentry: true,
      allowContinuityWording: true,
      shouldCleanStart: false,
      shouldAvoidAssumedContinuity: false,
      shouldBiasTowardFreshOpening: false,
      hints: ["soft_return_allowed", "recent_reentry_can_feel_continuous"],
      warnings: [],
    };
  }

  // --- RULE C — medium pause → practical rejoin ---
  if (gapMs <= PRACTICAL_REJOIN_WINDOW_MS) {
    return {
      reentryMode: "practical_rejoin",
      allowWarmReentry: false,
      allowContinuityWording: false,
      shouldCleanStart: true,
      shouldAvoidAssumedContinuity: true,
      shouldBiasTowardFreshOpening: false,
      hints: ["practical_rejoin_preferred"],
      warnings: ["continuity_stale_for_warm_reentry"],
    };
  }

  // --- RULE D — long pause → cold reset ---
  return {
    reentryMode: "cold_reset",
    allowWarmReentry: false,
    allowContinuityWording: false,
    shouldCleanStart: true,
    shouldAvoidAssumedContinuity: true,
    shouldBiasTowardFreshOpening: true,
    hints: ["fresh_opening_bias_after_long_gap"],
    warnings: ["continuity_stale_for_warm_reentry", "long_gap_requires_clean_return"],
  };
}
