/**
 * Voice Response Assembly Layer v1.0
 *
 * Bounded spoken-first response assembly — prepares text for voice delivery
 * BEFORE TTS synthesis. Makes text naturally speakable, not just readable.
 *
 * Assembly modes:
 *   direct_spoken      — clean, fast, straight to the point
 *   soft_spoken        — gentle but not vague
 *   guided_spoken      — measured, structured for explanation
 *   supportive_spoken  — calming, spaced, low-pressure
 *
 * This layer does NOT:
 *   - Use LLM or generative rewriting
 *   - Change meaning or facts
 *   - Create new content
 *   - Regenerate the response from scratch
 *   - Replace style/cadence/variation layers
 */

export type VoiceAssemblyMode =
  | "direct_spoken"
  | "soft_spoken"
  | "guided_spoken"
  | "supportive_spoken";

export interface VoiceAssemblyInput {
  text: string;
  userTone?: "neutral" | "warm" | "direct" | "support-seeking";
  responseStyle?: "warm" | "supportive" | "concise" | "neutral";
  cadenceMode?:
    | "crisp_direct"
    | "warm_compact"
    | "steady_explanatory"
    | "soft_guided"
    | "supportive_gentle";
  sentenceShape?:
    | "short_bursts"
    | "mixed_natural"
    | "smooth_layered";
  answerLength?: "short" | "medium" | "long";
  taskComplexity?: "low" | "medium" | "high";
  isFollowUp?: boolean;
  isVoiceReply?: boolean;
}

export interface VoiceAssemblyDecision {
  mode: VoiceAssemblyMode;
  fullSpokenText: string;
  firstSentenceText: string | null;
  shouldShortenSentences: boolean;
  shouldReduceDensity: boolean;
  shouldNormalizeOpeners: boolean;
  shouldPrepareFirstSentence: boolean;
  hints: string[];
  warnings: string[];
}

// ============================================================================
// Spoken text cleanup heuristics — deterministic, meaning-preserving
// ============================================================================

/** Leading fillers that add noise in spoken delivery */
const LEADING_FILLERS = [
  /^(ну[,.\s]+)*(короче[,.\s]+)*(слушай[,.\s]*)*(смотри[,.\s]*[,\.]?\s*)*(так\s+)*(вот\s+)*(итак\s*[,\.]?\s*)/iu,
  /^(во-первых\s*[,\.]?\s*)/iu,
];

/** Heavy written connectors that sound awkward when spoken */
const WRITTEN_CONNECTORS = [
  /\s*—\s+/g,
  /\s*:\s+/g,
];

/** Dangling openers that should be cleaned or completed */
const DANGLING_OPENERS = [
  /^(смотри,?\s*)/iu,
  /^(короче,?\s*)/iu,
  /^(ну,?\s*)/iu,
  /^(во-первых,?\s*)/iu,
  /^(потому что,?\s*)/iu,
];

/**
 * Extract the first sentence from text.
 * Returns null if no clean sentence boundary found.
 */
export function extractFirstSentence(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Try to find first sentence-ending punctuation
  const match = trimmed.match(/^([^.!?…]*[.!?…]+)/u);
  if (match && match[1].length >= 5 && match[1].length <= 200) {
    return match[1].trim();
  }

  // If no punctuation, check if text is short enough to be one unit
  if (trimmed.length <= 100) {
    return trimmed;
  }

  return null;
}

/**
 * Reduce written-style density in text.
 * Replaces heavy written connectors with spoken-friendly breaks.
 */
export function reduceWrittenDensity(text: string): string {
  let result = text;

  // Replace em-dashes with periods + space (spoken pause)
  result = result.replace(/\s*—\s+/g, ". ");

  // Replace colons with periods where they introduce explanation
  result = result.replace(/\s*:\s+/g, ". ");

  // Normalize multiple spaces
  result = result.replace(/\s{2,}/g, " ");

  // Normalize multiple periods
  result = result.replace(/\.{3,}/g, "...");

  return result.trim();
}

/**
 * Normalize opening fillers for spoken delivery.
 * Removes or softens heavy written openers.
 */
function normalizeOpeners(text: string, mode: VoiceAssemblyMode): string {
  let result = text;

  // Remove heavy fillers for direct mode — process each filler separately
  if (mode === "direct_spoken") {
    const fillers = [/^ну[,.\s]*/iu, /^короче[,.\s]*/iu, /^слушай[,.\s]*/iu, /^смотри[,.\s]*/iu, /^так\s+/iu, /^вот\s+/iu, /^итак[,.\s]*/iu, /^во-первых[,.\s]*/iu];
    for (const filler of fillers) {
      result = result.replace(filler, "");
    }
  }

  // Soften openers for supportive mode — remove dangling openers
  if (mode === "supportive_spoken" || mode === "soft_spoken") {
    const openers = [/^смотри[,.\s]*/iu, /^короче[,.\s]*/iu, /^ну[,.\s]*/iu, /^во-первых[,.\s]*/iu, /^потому что[,.\s]*/iu];
    for (const opener of openers) {
      result = result.replace(opener, "");
    }
  }

  // Clean openers for guided mode too — explanatory text shouldn't start with fillers
  if (mode === "guided_spoken") {
    const openers = [/^смотри[,.\s]*/iu, /^короче[,.\s]*/iu, /^ну[,.\s]*/iu, /^итак[,.\s]*/iu];
    for (const opener of openers) {
      result = result.replace(opener, "");
    }
  }

  // Clean up leading whitespace after removal
  result = result.replace(/^\s+/, "");

  // Capitalize first letter if needed
  if (result && result[0] !== result[0].toUpperCase()) {
    result = result[0].toUpperCase() + result.slice(1);
  }

  return result;
}

/**
 * Make first sentence voice-ready.
 * Returns cleaned first sentence or null if not possible.
 */
export function makeFirstSentenceVoiceReady(
  text: string,
  input: VoiceAssemblyInput,
): string | null {
  const first = extractFirstSentence(text);
  if (!first) return null;

  // Don't return tiny fragments
  if (first.length < 10) return null;

  // For supportive mode, ensure first sentence isn't abrupt
  const mode = decideAssemblyMode(input);
  if (mode === "supportive_spoken" || mode === "soft_spoken") {
    // Check if first sentence is too short/abrupt
    if (first.length < 20) {
      // Try to include second sentence for completeness
      const trimmed = text.trim();
      const sentences = trimmed.split(/(?<=[.!?…])\s+/u).filter(Boolean);
      if (sentences.length >= 2) {
        const combined = sentences[0] + " " + sentences[1];
        if (combined.length <= 200) {
          return combined;
        }
      }
    }
  }

  return first;
}

/**
 * Normalize text for spoken delivery.
 * Applies mode-appropriate cleanup without changing meaning.
 */
export function normalizeForSpokenDelivery(
  text: string,
  input: VoiceAssemblyInput,
): string {
  const mode = decideAssemblyMode(input);
  let result = text;

  // Normalize openers
  result = normalizeOpeners(result, mode);

  // Reduce density for complex/long text
  const shouldReduce =
    input.taskComplexity === "high" ||
    input.answerLength === "long" ||
    input.cadenceMode === "steady_explanatory" ||
    input.cadenceMode === "soft_guided";

  if (shouldReduce) {
    result = reduceWrittenDensity(result);
  }

  // Shorten sentences for complex content
  if (input.taskComplexity === "high" || input.cadenceMode === "steady_explanatory") {
    // Split very long sentences (>150 chars) at commas
    const parts = result.split(/(?<=[.!?…])\s*/u);
    const shortened = parts.map((p) => {
      if (p.length > 150) {
        return p.replace(/,\s+/g, ". ").replace(/\s{2,}/g, " ");
      }
      return p;
    });
    result = shortened.join(" ");
  }

  // Don't over-split short answers
  if (input.answerLength === "short") {
    // Keep as-is — already concise
  }

  // Final whitespace normalization
  result = result.replace(/\s{2,}/g, " ").trim();

  return result;
}

/**
 * Decide assembly mode based on input context.
 */
function decideAssemblyMode(input: VoiceAssemblyInput): VoiceAssemblyMode {
  // RULE A — direct mode
  if (
    input.userTone === "direct" ||
    input.cadenceMode === "crisp_direct"
  ) {
    return "direct_spoken";
  }

  // RULE B — supportive mode
  if (
    input.userTone === "support-seeking" ||
    input.responseStyle === "supportive" ||
    input.cadenceMode === "supportive_gentle"
  ) {
    return "supportive_spoken";
  }

  // RULE C — guided explanation
  if (
    input.cadenceMode === "soft_guided" ||
    input.cadenceMode === "steady_explanatory" ||
    input.taskComplexity === "high"
  ) {
    return "guided_spoken";
  }

  // Default: soft spoken for warm/neutral
  return "soft_spoken";
}

// ============================================================================
// Main assembly function
// ============================================================================

/**
 * Assemble voice response for spoken delivery.
 * Pure function — deterministic, debuggable.
 */
export function assembleVoiceResponse(
  input: VoiceAssemblyInput,
): VoiceAssemblyDecision {
  const mode = decideAssemblyMode(input);
  const hints: string[] = [];
  const warnings: string[] = [];

  // Normalize text for spoken delivery
  const fullSpokenText = normalizeForSpokenDelivery(input.text, input);

  // Extract and prepare first sentence
  const firstSentenceText = makeFirstSentenceVoiceReady(fullSpokenText, input);

  // Determine flags
  const shouldShortenSentences =
    input.taskComplexity === "high" ||
    input.cadenceMode === "steady_explanatory";

  const shouldReduceDensity =
    input.taskComplexity === "high" ||
    input.answerLength === "long" ||
    input.cadenceMode === "steady_explanatory" ||
    input.cadenceMode === "soft_guided";

  const shouldNormalizeOpeners =
    mode === "direct_spoken" ||
    mode === "supportive_spoken";

  const shouldPrepareFirstSentence =
    !!firstSentenceText && firstSentenceText.length >= 15;

  // Build hints
  if (fullSpokenText !== input.text) {
    hints.push("spoken_cleanup_applied");
  }

  if (shouldPrepareFirstSentence) {
    hints.push("first_sentence_prepared_for_voice");
  }

  if (shouldReduceDensity) {
    hints.push("reduce_written_density");
  }

  if (mode === "direct_spoken") {
    hints.push("direct_opening_compacted");
  }

  if (mode === "supportive_spoken" || mode === "soft_spoken") {
    hints.push("supportive_opening_softened");
  }

  if (input.text.length > 100) {
    hints.push("keep_opening_clean");
  }

  // Build warnings
  if (shouldReduceDensity) {
    warnings.push("source_text_too_dense_for_voice");
  }

  if (firstSentenceText && firstSentenceText !== extractFirstSentence(input.text)) {
    warnings.push("first_sentence_needed_cleanup");
  }

  if (mode === "supportive_spoken" && input.text.length < 30) {
    warnings.push("supportive_text_risk_of_abruptness");
  }

  if (input.taskComplexity === "high") {
    warnings.push("complex_written_structure_detected");
  }

  if (fullSpokenText !== input.text) {
    warnings.push("voice_assembly_preserved_meaning_with_cleanup");
  }

  return {
    mode,
    fullSpokenText,
    firstSentenceText,
    shouldShortenSentences,
    shouldReduceDensity,
    shouldNormalizeOpeners,
    shouldPrepareFirstSentence,
    hints,
    warnings,
  };
}
