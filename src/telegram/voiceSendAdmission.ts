/**
 * Voice Quality Scoring / Send Admission Layer v1.0
 *
 * Bounded pre-send quality admission — evaluates the final spoken output
 * BEFORE synthesis/send and decides whether voice is product-worth sending.
 *
 * Not every valid voice output deserves to be sent.
 *
 * This layer does NOT:
 *   - Build ML scoring systems or ranker services
 *   - Add DB / persistence / migrations
 *   - Perform real audio waveform analysis
 *   - Use LLM calls or generative evaluation
 *   - Duplicate assembly / cadence / delivery policy logic
 *   - Rewrite bot runtime or provider contracts
 *
 * It ONLY evaluates the ready textual spoken output and decides:
 *   send_voice, send_voice_with_caution, or downgrade_to_text
 */

// ============================================================================
// Domain model
// ============================================================================

export type VoiceSendAdmissionMode =
  | "send_voice"
  | "send_voice_with_caution"
  | "downgrade_to_text";

export interface VoiceSendAdmissionInput {
  finalSpokenText: string;
  originalDeliveryText: string;

  deliveryMode?: "fast_voice" | "quality_voice" | "text_only";
  providerChoice?: "say_macos" | "kozy" | "none";

  responseStyle?: "warm" | "supportive" | "concise" | "neutral";
  presenceMode?: "fresh" | "continuing" | "soft_followup" | "reset";
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

  interruptionRisk?: "low" | "medium" | "high";
}

export interface VoiceSendAdmissionDecision {
  admissionMode: VoiceSendAdmissionMode;

  qualityScore: number; // 0–100

  shouldSendVoice: boolean;
  shouldDowngradeToText: boolean;
  shouldMarkAsBorderline: boolean;

  hints: string[];
  warnings: string[];
}

// ============================================================================
// Scoring helpers — deterministic, heuristic, no ML
// ============================================================================

/**
 * DIMENSION A — spoken compactness
 * Evaluates whether the spoken output is a comfortable length for listening.
 * Too long → heavy and tiring. Too short → not worth voice overhead.
 */
export function scoreCompactness(text: string): number {
  const len = text.trim().length;

  // Optimal range: 30-200 chars (roughly 5-35 seconds of speech)
  if (len >= 30 && len <= 200) {
    return 90;
  }

  // Slightly long: 200-300 chars — still acceptable but less ideal
  if (len > 200 && len <= 300) {
    return 70;
  }

  // Slightly short: 15-30 chars — voice overhead is questionable
  if (len >= 15 && len < 30) {
    return 55;
  }

  // Long: 300-450 chars — heavy for voice
  if (len > 300 && len <= 450) {
    return 35;
  }

  // Overly long: > 450 chars — too heavy for comfortable listening
  if (len > 450) {
    return 10;
  }

  // Very short: < 15 chars — not worth voice
  return 20;
}

/**
 * DIMENSION B — opening quality
 * Evaluates whether the first phrase of the spoken output is strong and clean.
 * Weak/dangling openers reduce perceived quality.
 */
export function scoreOpeningQuality(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 10;

  // Check for weak opening patterns
  const weakOpeners = [
    /^(ну[,.\s]*)+(ну)/iu, // repeated filler
    /^(так\s+так)/iu, // stutter-like
    /^(короче\s+короче)/iu, // repeated
    /^\s*[,;…-]/, // starts with punctuation
    /^\s*[^а-яa-z0-9]/iu, // starts with special char (not letter/digit)
    /^(ну|так|вот|итак|короче)\s*[.…]*\s*$/iu, // just a filler + pause
    /^(ну|так|вот|короче)\s*[,.\s]*[^а-яa-z]/iu, // filler + non-letter
  ];

  for (const pattern of weakOpeners) {
    if (pattern.test(trimmed)) {
      return 30;
    }
  }

  // Strong opening: starts with a clear word, not filler
  const strongStart = /^[а-яa-z]/iu.test(trimmed);
  if (strongStart) {
    // Check if first word is substantive (not just a filler)
    const fillers = /^(ну|так|вот|итак|короче|слушай|смотри|значит|типа|как бы|в общем)/iu;
    if (!fillers.test(trimmed)) {
      return 90;
    }
    // Starts with filler but has content after
    const afterFiller = trimmed.replace(fillers, "").replace(/^[\s,.…]+/, "").trim();
    if (afterFiller.length > 10) {
      return 70;
    }
    return 40;
  }

  return 40;
}

/**
 * DIMENSION C — voice worthiness
 * Evaluates whether voice adds real value vs text for this turn.
 * Compares final spoken text to original delivery text.
 */
export function scoreVoiceWorthiness(text: string, original: string): number {
  const spoken = text.trim();
  const orig = original.trim();

  // Empty → not worth voice
  if (!spoken) return 10;

  // If spoken text is essentially identical to original,
  // voice adds value through natural delivery
  if (spoken === orig) {
    return 80;
  }

  // If spoken text was significantly modified/shortened,
  // check if meaning is preserved
  const spokenWords = spoken.toLowerCase().split(/\s+/).filter(Boolean);
  const origWords = orig.toLowerCase().split(/\s+/).filter(Boolean);

  // Calculate rough overlap (Jaccard-like)
  const spokenSet = new Set(spokenWords);
  const origSet = new Set(origWords);
  const intersection = [...spokenSet].filter((w) => origSet.has(w)).length;
  const union = new Set([...spokenSet, ...origSet]).size;
  const overlap = union > 0 ? intersection / union : 0;

  // High overlap → voice still adds value
  if (overlap > 0.7) {
    return 75;
  }

  // Medium overlap → some content was changed, voice adds less
  if (overlap > 0.4) {
    return 55;
  }

  // Low overlap → heavily modified, voice value is questionable
  return 35;
}

/**
 * DIMENSION D — cadence-product fit
 * Evaluates whether the cadence mode matches the delivery shape.
 * Mismatched cadence + length = poor product fit.
 */
function scoreCadenceFit(input: VoiceSendAdmissionInput): number {
  const textLen = input.finalSpokenText.trim().length;
  const cadence = input.cadenceMode ?? "steady_explanatory";
  const delivery = input.deliveryMode ?? "fast_voice";

  // Fast voice with heavy text → very bad fit
  if (delivery === "fast_voice" && textLen > 300) {
    return 15;
  }

  // Fast voice with explanatory cadence → mild mismatch
  if (delivery === "fast_voice" && cadence === "steady_explanatory") {
    return 55;
  }

  // Quality voice with tiny output → bad fit (overkill)
  if (delivery === "quality_voice" && textLen < 40) {
    return 35;
  }

  // Quality voice with very long text → also bad fit (too heavy)
  if (delivery === "quality_voice" && textLen > 400) {
    return 20;
  }

  // Crisp direct cadence with long text → mismatch
  if (cadence === "crisp_direct" && textLen > 200) {
    return 25;
  }

  // Supportive gentle cadence with very short text → mismatch
  if (cadence === "supportive_gentle" && textLen < 30) {
    return 45;
  }

  // Steady explanatory cadence with very short text → mismatch
  if (cadence === "steady_explanatory" && textLen < 30) {
    return 45;
  }

  // Good fit in most cases
  return 80;
}

// ============================================================================
// Core admission decision function
// ============================================================================

/**
 * Decide voice send admission for the current turn.
 * Pure function — deterministic, bounded, advisory.
 */
export function decideVoiceSendAdmission(
  input: VoiceSendAdmissionInput,
): VoiceSendAdmissionDecision {
  const hints: string[] = [];
  const warnings: string[] = [];

  const spokenText = input.finalSpokenText.trim();
  const originalText = input.originalDeliveryText.trim();
  const deliveryMode = input.deliveryMode ?? "fast_voice";
  const cadence = input.cadenceMode ?? "steady_explanatory";
  const interruptionRisk = input.interruptionRisk ?? "low";

  // ========================================================================
  // RULE D — text-only delivery mode remains final
  // ========================================================================
  if (deliveryMode === "text_only") {
    return {
      admissionMode: "downgrade_to_text",
      qualityScore: 0,
      shouldSendVoice: false,
      shouldDowngradeToText: true,
      shouldMarkAsBorderline: false,
      hints: [],
      warnings: ["delivery_mode_not_worth_voice_send"],
    };
  }

  // Empty spoken text → downgrade
  if (!spokenText) {
    return {
      admissionMode: "downgrade_to_text",
      qualityScore: 0,
      shouldSendVoice: false,
      shouldDowngradeToText: true,
      shouldMarkAsBorderline: false,
      hints: [],
      warnings: ["spoken_output_empty"],
    };
  }

  // ========================================================================
  // Compute scoring dimensions
  // ========================================================================
  const compactnessScore = scoreCompactness(spokenText);
  const openingScore = scoreOpeningQuality(spokenText);
  const worthinessScore = scoreVoiceWorthiness(spokenText, originalText);
  const cadenceFitScore = scoreCadenceFit(input);

  // ========================================================================
  // DIMENSION E — interruption fit
  // Long voice + high interruption risk = fragile delivery
  // ========================================================================
  let interruptionPenalty = 0;
  if (interruptionRisk === "high" && spokenText.length > 50) {
    interruptionPenalty = 15;
    warnings.push("high_interruption_risk_for_long_audio");
  } else if (interruptionRisk === "medium" && spokenText.length > 200) {
    interruptionPenalty = 10;
  }

  // Extreme length penalty — text > 500 chars is fundamentally not listenable
  let extremeLengthPenalty = 0;
  if (spokenText.length > 500) {
    extremeLengthPenalty = 25;
    warnings.push("spoken_output_too_heavy_for_voice");
  } else if (spokenText.length > 350) {
    extremeLengthPenalty = 10;
  }

  // ========================================================================
  // Weighted composite score
  // ========================================================================
  // Weights: compactness 30%, opening 20%, worthiness 25%, cadence fit 25%
  let qualityScore = Math.round(
    compactnessScore * 0.30 +
    openingScore * 0.20 +
    worthinessScore * 0.25 +
    cadenceFitScore * 0.25 -
    interruptionPenalty -
    extremeLengthPenalty,
  );

  // Clamp to 0-100
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  // ========================================================================
  // Build dimension-specific hints/warnings
  // ========================================================================

  // Compactness hints/warnings
  if (compactnessScore >= 70) {
    hints.push("spoken_output_is_compact_and_listenable");
  } else {
    warnings.push("spoken_output_too_heavy_for_voice");
  }

  // Opening quality hints/warnings
  if (openingScore >= 70) {
    hints.push("opening_quality_good_for_voice");
  } else {
    warnings.push("opening_quality_weak");
  }

  // Worthiness hints/warnings
  if (worthinessScore >= 60) {
    hints.push("voice_surface_adds_real_value");
  } else {
    warnings.push("voice_adds_little_value_here");
  }

  // Cadence fit hints/warnings
  if (cadenceFitScore >= 60) {
    hints.push("cadence_matches_delivery_shape");
  } else {
    warnings.push("cadence_product_mismatch");
  }

  // ========================================================================
  // RULE A — weak spoken output should downgrade to text
  // ========================================================================
  if (qualityScore < 40) {
    return {
      admissionMode: "downgrade_to_text",
      qualityScore,
      shouldSendVoice: false,
      shouldDowngradeToText: true,
      shouldMarkAsBorderline: false,
      hints: hints.filter((h) => !h.includes("listenable") && !h.includes("good_for_voice")),
      warnings: [...warnings, "delivery_downgraded_due_to_low_quality_score"],
    };
  }

  // ========================================================================
  // RULE B — borderline but acceptable output may still send
  // ========================================================================
  if (qualityScore < 65) {
    return {
      admissionMode: "send_voice_with_caution",
      qualityScore,
      shouldSendVoice: true,
      shouldDowngradeToText: false,
      shouldMarkAsBorderline: true,
      hints: [...hints, "voice_turn_product_acceptable"],
      warnings: [...warnings, "voice_turn_is_borderline_quality"],
    };
  }

  // ========================================================================
  // RULE C — strong spoken output sends normally
  // ========================================================================
  hints.push("voice_turn_product_fit_is_strong");

  return {
    admissionMode: "send_voice",
    qualityScore,
    shouldSendVoice: true,
    shouldDowngradeToText: false,
    shouldMarkAsBorderline: false,
    hints,
    warnings,
  };
}
