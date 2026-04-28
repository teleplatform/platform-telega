/**
 * Voice Natural Variation Layer v1.0
 *
 * Bounded micro-variation for repeated phrasing — NOT creativity, NOT LLM rewriting.
 * Rotates among approved template variants for openers/confirmations/transitions.
 *
 * Variation modes:
 *   none        — original text preserved (no safe template matched)
 *   light       — rotated among approved variants for opener/confirmation
 *   micro_shift — slight transition/connector variation
 *
 * This layer does NOT:
 *   - Change meaning or factual content
 *   - Add new information
 *   - Create persona drift
 *   - Use LLM or generative paraphrasing
 *   - Override style or presence decisions
 */

export type VariationMode = "none" | "light" | "micro_shift";

export interface VariationResult {
  mode: VariationMode;
  reason: string;
  /** Which template family was used (if any) */
  templateFamily: string | null;
  /** Whether text was actually changed */
  textAdjusted: boolean;
  /** Final text after variation (may equal original) */
  shapedText: string;
}

// ============================================================================
// Safe Template Families — approved variants only, no generative freedom
// ============================================================================

/** Greeting openers — rotates to avoid robotic repetition */
const GREETING_VARIANTS = [
  "Привет! ",
  "Привет. ",
  "Хей! ",
  "Здравствуй! ",
];

/** Concise confirmations — rotates among equivalents */
const CONFIRMATION_VARIANTS = [
  "Понял. ",
  "Принял. ",
  "Ясно. ",
  "Хорошо. ",
];

/** Explanatory openers — slight variation in how to start explaining */
const EXPLANATION_OPENERS = [
  "Сейчас объясню. ",
  "Объясняю. ",
  "Сейчас коротко покажу. ",
  "Вот смотри. ",
];

/** Supportive connectors — gentle transitions after supportive content */
const SUPPORTIVE_CONNECTORS = [
  "Давай спокойно разберём. ",
  "Можно пойти шаг за шагом. ",
  "Давай по порядку. ",
];

/** Deterministic selection: hash-based rotation */
function deterministicIndex(seed: string, arrayLength: number): number {
  // Simple hash for debuggable, reproducible selection
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 32-bit int
  }
  return Math.abs(hash) % arrayLength;
}

// ============================================================================
// Variation Rules — explicit, bounded, safe
// ============================================================================

/**
 * Detect which template family (if any) the text starts with.
 * Returns the family name and the index of the matching variant.
 */
function detectTemplateFamily(text: string): { family: string; index: number; prefix: string } | null {
  const trimmed = text.trim();

  // Check greetings
  for (let i = 0; i < GREETING_VARIANTS.length; i++) {
    if (trimmed.startsWith(GREETING_VARIANTS[i])) {
      return { family: "greeting", index: i, prefix: GREETING_VARIANTS[i] };
    }
  }

  // Check confirmations
  for (let i = 0; i < CONFIRMATION_VARIANTS.length; i++) {
    if (trimmed.startsWith(CONFIRMATION_VARIANTS[i])) {
      return { family: "confirmation", index: i, prefix: CONFIRMATION_VARIANTS[i] };
    }
  }

  // Check explanation openers
  for (let i = 0; i < EXPLANATION_OPENERS.length; i++) {
    if (trimmed.startsWith(EXPLANATION_OPENERS[i])) {
      return { family: "explanation", index: i, prefix: EXPLANATION_OPENERS[i] };
    }
  }

  // Check supportive connectors
  for (let i = 0; i < SUPPORTIVE_CONNECTORS.length; i++) {
    if (trimmed.startsWith(SUPPORTIVE_CONNECTORS[i])) {
      return { family: "supportive", index: i, prefix: SUPPORTIVE_CONNECTORS[i] };
    }
  }

  return null;
}

/**
 * Apply natural variation to text.
 * Deterministic based on traceId + chatId + family for debuggability.
 *
 * @param text - The text after presence shaping
 * @param traceId - Current trace ID for deterministic selection
 * @param chatId - Chat ID for per-chat variation
 * @param styleMode - Current style mode (for context-aware variation)
 * @param presenceMode - Current presence mode (for context-aware variation)
 */
export function applyNaturalVariation(
  text: string,
  traceId: string,
  chatId: string | number,
  styleMode: string,
  presenceMode: string,
): VariationResult {
  const trimmed = text.trim();

  // Skip variation for very short text (no meaningful template to rotate)
  if (trimmed.length < 10) {
    return {
      mode: "none",
      reason: "text_too_short",
      templateFamily: null,
      textAdjusted: false,
      shapedText: trimmed,
    };
  }

  // Skip variation for technical/factual content
  // Heuristic: contains URLs, numbers, code-like patterns, or technical terms
  if (/\b(http|https|ftp|www\.|\d{4,}|\.ts|\.js|function|class|import|export)\b/i.test(trimmed)) {
    return {
      mode: "none",
      reason: "technical_content_skipped",
      templateFamily: null,
      textAdjusted: false,
      shapedText: trimmed,
    };
  }

  // Detect template family
  const match = detectTemplateFamily(trimmed);
  if (!match) {
    return {
      mode: "none",
      reason: "no_template_matched",
      templateFamily: null,
      textAdjusted: false,
      shapedText: trimmed,
    };
  }

  // Get the appropriate variant list
  let variants: string[];
  switch (match.family) {
    case "greeting":
      variants = GREETING_VARIANTS;
      break;
    case "confirmation":
      variants = CONFIRMATION_VARIANTS;
      break;
    case "explanation":
      variants = EXPLANATION_OPENERS;
      break;
    case "supportive":
      variants = SUPPORTIVE_CONNECTORS;
      break;
    default:
      return {
        mode: "none",
        reason: "unknown_family",
        templateFamily: null,
        textAdjusted: false,
        shapedText: trimmed,
      };
  }

  // Deterministic selection: rotate based on trace + chat context
  const seed = `${chatId}-${match.family}-${traceId.slice(-6)}`;
  const newIndex = deterministicIndex(seed, variants.length);

  // Avoid same variant if possible (only if there are multiple variants)
  let finalIndex = newIndex;
  if (variants.length > 1 && newIndex === match.index) {
    finalIndex = (newIndex + 1) % variants.length;
  }

  const newPrefix = variants[finalIndex];
  const rest = trimmed.slice(match.prefix.length);
  const newText = newPrefix + rest;

  // Guard: verify meaning is preserved (length shouldn't change drastically)
  if (Math.abs(newText.length - trimmed.length) > trimmed.length * 0.3) {
    // Too much change — fall back to original
    return {
      mode: "none",
      reason: "variation_too_drastic",
      templateFamily: match.family,
      textAdjusted: false,
      shapedText: trimmed,
    };
  }

  const variationMode = match.family === "supportive" ? "micro_shift" : "light";

  return {
    mode: variationMode,
    reason: `rotated_${match.family}_variant`,
    templateFamily: match.family,
    textAdjusted: true,
    shapedText: newText,
  };
}
