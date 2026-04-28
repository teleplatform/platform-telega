/**
 * Voice Rhythm / Cadence Layer v1.0
 *
 * Bounded deterministic cadence/rhythm decisions for spoken responses.
 * Controls how speech FLOWS — not what it says.
 *
 * Cadence modes:
 *   crisp_direct        — straight to the point, tight pacing
 *   soft_guided         — gentle guidance, slightly spaced phrasing
 *   steady_explanatory  — measured, explanatory, not rushed
 *   warm_compact        — friendly but concise
 *   supportive_gentle   — calming, spacious, low-pressure
 *
 * This layer does NOT:
 *   - Change meaning or factual content
 *   - Modify provider contracts
 *   - Use LLM or generative rewriting
 *   - Create new voice engines
 *   - Override style or strategy decisions
 */

export type VoiceCadenceMode =
  | "crisp_direct"
  | "soft_guided"
  | "steady_explanatory"
  | "warm_compact"
  | "supportive_gentle";

export type VoicePacingDensity = "tight" | "balanced" | "airy";

export type VoiceSentenceShape =
  | "short_bursts"
  | "mixed_natural"
  | "smooth_layered";

export interface VoiceCadenceDecision {
  cadenceMode: VoiceCadenceMode;
  pacingDensity: VoicePacingDensity;
  sentenceShape: VoiceSentenceShape;

  preferShortSentences: boolean;
  allowSoftLeadIn: boolean;
  allowTwoBeatDelivery: boolean;
  avoidDenseStacking: boolean;
  shouldEndCleanly: boolean;

  hints: string[];
  warnings: string[];
}

/** Input signals for cadence decision — extends existing voice context */
export interface VoiceCadenceInput {
  userTone?: "neutral" | "warm" | "direct" | "support-seeking";
  responseStyle?: "warm" | "supportive" | "concise" | "neutral";
  isFollowUp?: boolean;
  isVoiceReply?: boolean;
  taskComplexity?: "low" | "medium" | "high";
  answerLength?: "short" | "medium" | "long";
  relationshipMode?: "practical" | "warm" | "supportive";
}

/**
 * Decide cadence based on bounded rules.
 * Pure function — deterministic, debuggable, no randomness.
 */
export function decideVoiceCadence(input: VoiceCadenceInput): VoiceCadenceDecision {
  const userTone = input.userTone ?? "neutral";
  const responseStyle = input.responseStyle ?? "neutral";
  const isFollowUp = input.isFollowUp ?? false;
  const taskComplexity = input.taskComplexity ?? "medium";
  const answerLength = input.answerLength ?? "medium";
  const relationshipMode = input.relationshipMode ?? "practical";

  // =========================================================================
  // RULE A — direct users need tighter cadence
  // =========================================================================
  if (userTone === "direct") {
    return {
      cadenceMode: "crisp_direct",
      pacingDensity: "tight",
      sentenceShape: "short_bursts",
      preferShortSentences: true,
      allowSoftLeadIn: false,
      allowTwoBeatDelivery: false,
      avoidDenseStacking: false,
      shouldEndCleanly: true,
      hints: [
        "prefer_clean_spoken_chunks",
        "avoid_dense_written_style",
        "reduce_monotone_delivery",
      ],
      warnings: [
        "direct_mode_risk_of_abruptness",
      ],
    };
  }

  // =========================================================================
  // RULE B — supportive / warm contexts need softer cadence
  // =========================================================================
  if (userTone === "support-seeking" || responseStyle === "supportive") {
    return {
      cadenceMode: "supportive_gentle",
      pacingDensity: "airy",
      sentenceShape: "smooth_layered",
      preferShortSentences: false,
      allowSoftLeadIn: true,
      allowTwoBeatDelivery: true,
      avoidDenseStacking: true,
      shouldEndCleanly: true,
      hints: [
        "soften_opening_for_supportive_context",
        "allow_natural_pauses_between_phrases",
        "reduce_monotone_delivery",
      ],
      warnings: [
        "supportive_context_should_not_sound_brisk",
      ],
    };
  }

  // =========================================================================
  // RULE D — concise answers: short but natural
  // =========================================================================
  if (answerLength === "short") {
    return {
      cadenceMode: "warm_compact",
      pacingDensity: "tight",
      sentenceShape: "short_bursts",
      preferShortSentences: true,
      allowSoftLeadIn: false,
      allowTwoBeatDelivery: false,
      avoidDenseStacking: false,
      shouldEndCleanly: true,
      hints: [
        "keep_short_reply_natural",
        "reduce_monotone_delivery",
      ],
      warnings: [],
    };
  }

  // =========================================================================
  // RULE E — follow-up: slightly tighter but aligned with context
  // =========================================================================
  if (isFollowUp) {
    // If context is warm/supportive, don't become abrupt
    if (relationshipMode === "warm" || relationshipMode === "supportive") {
      return {
        cadenceMode: "warm_compact",
        pacingDensity: "balanced",
        sentenceShape: "short_bursts",
        preferShortSentences: true,
        allowSoftLeadIn: true,
        allowTwoBeatDelivery: false,
        avoidDenseStacking: false,
        shouldEndCleanly: true,
        hints: [
          "keep_short_reply_natural",
          "soften_opening_for_supportive_context",
          "reduce_monotone_delivery",
        ],
        warnings: [],
      };
    }

    // Otherwise: tighter but not abrupt
    return {
      cadenceMode: "crisp_direct",
      pacingDensity: "tight",
      sentenceShape: "short_bursts",
      preferShortSentences: true,
      allowSoftLeadIn: false,
      allowTwoBeatDelivery: false,
      avoidDenseStacking: false,
      shouldEndCleanly: true,
      hints: [
        "prefer_clean_spoken_chunks",
        "reduce_monotone_delivery",
      ],
      warnings: [],
    };
  }

  // =========================================================================
  // RULE C — medium/high complexity should not sound rushed
  // =========================================================================
  if (taskComplexity === "medium" || taskComplexity === "high") {
    // For high complexity with warm relationship, prefer soft_guided
    if (taskComplexity === "high" && relationshipMode === "warm") {
      return {
        cadenceMode: "soft_guided",
        pacingDensity: "balanced",
        sentenceShape: "smooth_layered",
        preferShortSentences: false,
        allowSoftLeadIn: true,
        allowTwoBeatDelivery: true,
        avoidDenseStacking: true,
        shouldEndCleanly: true,
        hints: [
          "prefer_clean_spoken_chunks",
          "avoid_dense_written_style",
          "reduce_monotone_delivery",
        ],
        warnings: [],
      };
    }

    return {
      cadenceMode: "steady_explanatory",
      pacingDensity: "balanced",
      sentenceShape: "mixed_natural",
      preferShortSentences: false,
      allowSoftLeadIn: false,
      allowTwoBeatDelivery: true,
      avoidDenseStacking: true,
      shouldEndCleanly: true,
      hints: [
        "avoid_dense_written_style",
        "reduce_monotone_delivery",
      ],
      warnings: [
        "reply_may_sound_too_dense_for_voice",
      ],
    };
  }

  // =========================================================================
  // RULE E — follow-up: slightly tighter but aligned with context
  // =========================================================================
  if (isFollowUp) {
    // If context is warm/supportive, don't become abrupt
    if (relationshipMode === "warm" || relationshipMode === "supportive") {
      return {
        cadenceMode: "warm_compact",
        pacingDensity: "balanced",
        sentenceShape: "short_bursts",
        preferShortSentences: true,
        allowSoftLeadIn: true,
        allowTwoBeatDelivery: false,
        avoidDenseStacking: false,
        shouldEndCleanly: true,
        hints: [
          "keep_short_reply_natural",
          "soften_opening_for_supportive_context",
          "reduce_monotone_delivery",
        ],
        warnings: [],
      };
    }

    // Otherwise: tighter but not abrupt
    return {
      cadenceMode: "crisp_direct",
      pacingDensity: "tight",
      sentenceShape: "short_bursts",
      preferShortSentences: true,
      allowSoftLeadIn: false,
      allowTwoBeatDelivery: false,
      avoidDenseStacking: false,
      shouldEndCleanly: true,
      hints: [
        "prefer_clean_spoken_chunks",
        "reduce_monotone_delivery",
      ],
      warnings: [],
    };
  }

  // =========================================================================
  // Default — warm/neutral context
  // =========================================================================
  if (relationshipMode === "warm" || responseStyle === "warm") {
    return {
      cadenceMode: "warm_compact",
      pacingDensity: "balanced",
      sentenceShape: "mixed_natural",
      preferShortSentences: false,
      allowSoftLeadIn: true,
      allowTwoBeatDelivery: false,
      avoidDenseStacking: false,
      shouldEndCleanly: true,
      hints: [
        "reduce_monotone_delivery",
      ],
      warnings: [],
    };
  }

  // Default neutral
  return {
    cadenceMode: "steady_explanatory",
    pacingDensity: "balanced",
    sentenceShape: "mixed_natural",
    preferShortSentences: false,
    allowSoftLeadIn: false,
    allowTwoBeatDelivery: false,
    avoidDenseStacking: false,
    shouldEndCleanly: true,
    hints: [
      "reduce_monotone_delivery",
    ],
    warnings: [],
  };
}

/**
 * Map cadence decision to speech rate hint for fast provider (say_macos).
 * Cadence affects rhythm — rate is the closest say_macos control.
 */
export function cadenceToSpeechRate(cadence: VoiceCadenceDecision): number {
  switch (cadence.cadenceMode) {
    case "crisp_direct":
      return 220; // faster, direct
    case "warm_compact":
      return 200; // default
    case "steady_explanatory":
      return 190; // measured, not rushed
    case "soft_guided":
      return 180; // gentle guidance
    case "supportive_gentle":
      return 160; // calming, spacious
    default:
      return 200;
  }
}

/**
 * Map cadence decision to speech rate hint for Kozy (voice_quality).
 * Kozy doesn't accept rate params, so we return a hint for observability.
 */
export function cadenceToKozyHint(cadence: VoiceCadenceDecision): string {
  return `cadence=${cadence.cadenceMode},pacing=${cadence.pacingDensity},shape=${cadence.sentenceShape}`;
}
