/**
 * Realtime First-Audio Layer v1.0
 *
 * Bounded first-audio optimization — reduces perceived latency by starting
 * with a clean spoken chunk when safe. NOT a streaming engine.
 *
 * Modes:
 *   disabled               — first-audio optimization turned off
 *   single_chunk_fast_start — send first chunk immediately, skip remainder
 *   full_response_only      — normal behavior, no split
 *
 * This layer does NOT:
 *   - Create websocket/RTP/VoIP streaming
 *   - Rewrite provider contracts
 *   - Use LLM or generative splitting
 *   - Break meaning for speed
 *   - Start with broken/abrupt audio
 */

export type FirstAudioMode = "disabled" | "single_chunk_fast_start" | "full_response_only";

export interface FirstAudioInput {
  text: string;
  isVoiceReply: boolean;
  taskComplexity?: "low" | "medium" | "high";
  answerLength?: "short" | "medium" | "long";
  cadenceMode?: "crisp_direct" | "warm_compact" | "steady_explanatory" | "soft_guided" | "supportive_gentle";
  sentenceShape?: "short_bursts" | "mixed_natural" | "smooth_layered";
}

export interface FirstAudioDecision {
  mode: FirstAudioMode;
  eligible: boolean;
  firstChunkText: string | null;
  remainderText: string | null;
  shouldUseFastStart: boolean;
  shouldSendSingleChunkOnly: boolean;
  hints: string[];
  warnings: string[];
}

// Bounded constants for split quality
const MIN_FIRST_CHUNK_CHARS = 35;
const MAX_FIRST_CHUNK_CHARS = 180;

// Patterns that indicate a dangling/unfinished clause
const DANGLING_PATTERNS = [
  /\b(потому что|так как|поэтому|значит|следовательно|во-первых|во-вторых|например|то есть|например)\s*$/iu,
  /\b(because|since|therefore|so|however|for example|that is|namely)\s*$/iu,
  /[,\s]$/u, // ends with comma or space → unfinished
];

// Sentence-ending punctuation for clean split
const SENTENCE_END_RE = /[.!?…]+/u;
const SAFE_BREAK_RE = /[,;—–]\s*/u;

/**
 * Check if a text chunk sounds like a complete spoken unit.
 */
export function isCleanSpokenChunk(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < MIN_FIRST_CHUNK_CHARS) return false;
  if (trimmed.length > MAX_FIRST_CHUNK_CHARS) return false;

  // Must end with sentence-ending punctuation
  if (!SENTENCE_END_RE.test(trimmed)) {
    // Allow safe comma break only if it sounds natural
    if (!SAFE_BREAK_RE.test(trimmed)) return false;
  }

  // Must not end with dangling pattern
  for (const pattern of DANGLING_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  return true;
}

/**
 * Try to split text into first audio chunk + remainder.
 * Returns {firstChunkText, remainderText} or {null, null} if no clean split.
 */
function splitForFirstAudio(text: string, input: FirstAudioInput): { firstChunkText: string | null; remainderText: string | null } {
  const trimmed = text.trim();

  // Too short to split
  if (trimmed.length <= MIN_FIRST_CHUNK_CHARS + 10) {
    return { firstChunkText: null, remainderText: null };
  }

  // Try to find a clean sentence boundary within MAX_FIRST_CHUNK_CHARS
  const searchLimit = Math.min(MAX_FIRST_CHUNK_CHARS, trimmed.length);
  const searchArea = trimmed.slice(0, searchLimit);

  // Priority 1: sentence-ending punctuation
  let bestSplit = -1;
  for (let i = searchLimit - 1; i >= MIN_FIRST_CHUNK_CHARS; i--) {
    const char = trimmed[i];
    if (char === '.' || char === '!' || char === '?' || char === '…') {
      // Check it's not an abbreviation (simple check: not followed by digit)
      const candidate = trimmed.slice(0, i + 1);
      if (isCleanSpokenChunk(candidate)) {
        bestSplit = i + 1;
        break;
      }
    }
  }

  // Priority 2: safe comma/dash break (only if sentence boundary not found)
  if (bestSplit < 0) {
    for (let i = searchLimit - 1; i >= MIN_FIRST_CHUNK_CHARS; i--) {
      const char = trimmed[i];
      if (char === ',' || char === ';' || char === '—' || char === '–') {
        const candidate = trimmed.slice(0, i + 1);
        if (candidate.length >= MIN_FIRST_CHUNK_CHARS && candidate.length <= MAX_FIRST_CHUNK_CHARS) {
          // Check candidate doesn't end with dangling pattern
          let isDangling = false;
          for (const pattern of DANGLING_PATTERNS) {
            if (pattern.test(candidate)) { isDangling = true; break; }
          }
          if (!isDangling) {
            bestSplit = i + 1;
            break;
          }
        }
      }
    }
  }

  if (bestSplit < 0) {
    return { firstChunkText: null, remainderText: null };
  }

  const firstChunk = trimmed.slice(0, bestSplit).trim();
  const remainder = trimmed.slice(bestSplit).trim();

  // Verify remainder is non-empty
  if (remainder.length < 5) {
    // Remainder too small — just send full response
    return { firstChunkText: null, remainderText: null };
  }

  return { firstChunkText: firstChunk, remainderText: remainder };
}

/**
 * Decide first-audio strategy based on input context.
 * Pure function — deterministic, debuggable.
 */
export function decideFirstAudio(input: FirstAudioInput): FirstAudioDecision {
  const text = input.text.trim();
  const isVoice = input.isVoiceReply;
  const cadenceMode = input.cadenceMode ?? "steady_explanatory";
  const answerLength = input.answerLength ?? "medium";

  // Not a voice reply → disabled
  if (!isVoice) {
    return {
      mode: "disabled",
      eligible: false,
      firstChunkText: null,
      remainderText: null,
      shouldUseFastStart: false,
      shouldSendSingleChunkOnly: false,
      hints: [],
      warnings: ["not_a_voice_reply"],
    };
  }

  // Empty text → disabled
  if (!text || text.length < MIN_FIRST_CHUNK_CHARS) {
    return {
      mode: "full_response_only",
      eligible: false,
      firstChunkText: null,
      remainderText: null,
      shouldUseFastStart: false,
      shouldSendSingleChunkOnly: false,
      hints: ["response_too_short_to_split"],
      warnings: [],
    };
  }

  // If text is already within fast-start bounds and sounds complete → use as-is
  if (text.length <= MAX_FIRST_CHUNK_CHARS && isCleanSpokenChunk(text)) {
    return {
      mode: "single_chunk_fast_start",
      eligible: true,
      firstChunkText: text,
      remainderText: null,
      shouldUseFastStart: true,
      shouldSendSingleChunkOnly: true,
      hints: ["fast_start_allowed", "clean_first_chunk_found", "response_already_optimal_size"],
      warnings: [],
    };
  }

  // RULE C — supportive / soft cadence must not sound abruptly cut
  if (cadenceMode === "supportive_gentle" || cadenceMode === "soft_guided") {
    // Only allow split if first chunk is naturally soft and complete
    const split = splitForFirstAudio(text, input);
    if (split.firstChunkText && isCleanSpokenChunk(split.firstChunkText)) {
      // Check first chunk doesn't sound harsh
      if (split.firstChunkText.length >= 50) {
        return {
          mode: "single_chunk_fast_start",
          eligible: true,
          firstChunkText: split.firstChunkText,
          remainderText: split.remainderText,
          shouldUseFastStart: true,
          shouldSendSingleChunkOnly: true, // In v1.0, send only first chunk for speed
          hints: ["fast_start_allowed", "clean_first_chunk_found", "prefer_full_response_for_soft_cadence"],
          warnings: [],
        };
      }
    }

    // No clean split → full response
    return {
      mode: "full_response_only",
      eligible: false,
      firstChunkText: null,
      remainderText: null,
      shouldUseFastStart: false,
      shouldSendSingleChunkOnly: false,
      hints: ["prefer_full_response_for_soft_cadence"],
      warnings: ["no_clean_boundary_for_fast_start"],
    };
  }

  // RULE D — direct / crisp cadence may start earlier
  if (cadenceMode === "crisp_direct" || cadenceMode === "warm_compact") {
    const split = splitForFirstAudio(text, input);
    if (split.firstChunkText && isCleanSpokenChunk(split.firstChunkText)) {
      return {
        mode: "single_chunk_fast_start",
        eligible: true,
        firstChunkText: split.firstChunkText,
        remainderText: split.remainderText,
        shouldUseFastStart: true,
        shouldSendSingleChunkOnly: true,
        hints: ["fast_start_allowed", "clean_first_chunk_found", "direct_mode_can_start_early"],
        warnings: [],
      };
    }

    return {
      mode: "full_response_only",
      eligible: false,
      firstChunkText: null,
      remainderText: null,
      shouldUseFastStart: false,
      shouldSendSingleChunkOnly: false,
      hints: [],
      warnings: ["no_clean_boundary_for_fast_start"],
    };
  }

  // RULE A — short/medium spoken answers may use fast first audio
  if (answerLength === "short" || answerLength === "medium") {
    const split = splitForFirstAudio(text, input);
    if (split.firstChunkText && isCleanSpokenChunk(split.firstChunkText)) {
      return {
        mode: "single_chunk_fast_start",
        eligible: true,
        firstChunkText: split.firstChunkText,
        remainderText: split.remainderText,
        shouldUseFastStart: true,
        shouldSendSingleChunkOnly: true,
        hints: ["fast_start_allowed", "clean_first_chunk_found", "first_chunk_quality_passed"],
        warnings: [],
      };
    }
  }

  // RULE B — long answers: split only if clean boundary exists
  if (answerLength === "long") {
    const split = splitForFirstAudio(text, input);
    if (split.firstChunkText && isCleanSpokenChunk(split.firstChunkText)) {
      return {
        mode: "single_chunk_fast_start",
        eligible: true,
        firstChunkText: split.firstChunkText,
        remainderText: split.remainderText,
        shouldUseFastStart: true,
        shouldSendSingleChunkOnly: true,
        hints: ["fast_start_allowed", "clean_first_chunk_found"],
        warnings: [],
      };
    }

    return {
      mode: "full_response_only",
      eligible: false,
      firstChunkText: null,
      remainderText: null,
      shouldUseFastStart: false,
      shouldSendSingleChunkOnly: false,
      hints: [],
      warnings: ["no_clean_boundary_for_fast_start", "response_too_dense_for_safe_first_audio"],
    };
  }

  // RULE F — default fallback to full response
  return {
    mode: "full_response_only",
    eligible: false,
    firstChunkText: null,
    remainderText: null,
    shouldUseFastStart: false,
    shouldSendSingleChunkOnly: false,
    hints: [],
    warnings: [],
  };
}
