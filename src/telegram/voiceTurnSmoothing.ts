/**
 * Voice Turn Smoothing Layer v1.0
 *
 * Bounded turn-edge shaping for spoken delivery — smoothes entry/exit of voice turns
 * so responses feel like natural continuations, not hard-cut audio packets.
 *
 * Entry modes:
 *   clean_direct_entry      — compact, straight to the point
 *   soft_continuation_entry — gentle reentry, no cold restart
 *   warm_reentry_entry      — warm follow-up feel
 *   supportive_gentle_entry — calming, low-pressure opening
 *
 * Exit modes:
 *   clean_stop        — crisp ending, no trailing
 *   soft_landing      — gentle fade-out for medium/long answers
 *   warm_hold         — warm continuation feel at ending
 *   supportive_hold   — emotionally non-harsh ending
 *
 * This layer does NOT:
 *   - Use audio DSP or prosody engines
 *   - Add SSML or TTS markup
 *   - Change meaning or facts
 *   - Rewrite content — only turn-edge shaping
 *   - Make all responses equally "soft"
 */

export type VoiceTurnEntryMode =
  | "clean_direct_entry"
  | "soft_continuation_entry"
  | "warm_reentry_entry"
  | "supportive_gentle_entry";

export type VoiceTurnExitMode =
  | "clean_stop"
  | "soft_landing"
  | "warm_hold"
  | "supportive_hold";

export interface VoiceTurnSmoothingInput {
  text: string;
  presenceMode?: "fresh" | "continuing" | "soft_followup" | "reset";
  responseStyle?: "warm" | "supportive" | "concise" | "neutral";
  cadenceMode?:
    | "crisp_direct"
    | "warm_compact"
    | "steady_explanatory"
    | "soft_guided"
    | "supportive_gentle";
  assemblyMode?:
    | "direct_spoken"
    | "soft_spoken"
    | "guided_spoken"
    | "supportive_spoken";
  isFollowUp?: boolean;
  answerLength?: "short" | "medium" | "long";
  taskComplexity?: "low" | "medium" | "high";
}

export interface VoiceTurnSmoothingDecision {
  entryMode: VoiceTurnEntryMode;
  exitMode: VoiceTurnExitMode;
  smoothedText: string;
  shouldSoftenEntry: boolean;
  shouldCompactEntry: boolean;
  shouldSoftenEnding: boolean;
  shouldKeepEndingClean: boolean;
  hints: string[];
  warnings: string[];
}

// ============================================================================
// Turn edge heuristics — deterministic, meaning-preserving
// ============================================================================

/** Abrupt opening fragments that sound harsh in spoken delivery */
const ABRUPT_OPENERS = [
  /^(так[.!\s]*)/iu,
  /^(ну[.!\s]*)/iu,
  /^(короче[.!\s]*)/iu,
  /^(смотри[.!\s,]*)/iu,
  /^(ладно[.!\s,]*)/iu,
];

/** Dangling/harsh endings that sound cut-off in spoken delivery */
const ABRUPT_ENDINGS = [
  /\s*[\u2026]{3,}\s*$/u,
  /\s*\.{3,}\s*$/u,
  /\s*(и все[.!\s]*)$/iu,
  /\s*(и всё[.!\s]*)$/iu,
  /\s*(вот[.!\s]*)$/iu,
  /\s*(короче[.!\s]*)$/iu,
  /\s*[,;]\s*$/u,
];

/**
 * Trim abrupt turn edges from text.
 * Removes harsh openers and dangling endings.
 */
export function trimAbruptTurnEdges(text: string): string {
  let result = text.trim();

  // Clean abrupt openers
  for (const pattern of ABRUPT_OPENERS) {
    result = result.replace(pattern, "");
  }

  // Clean abrupt endings
  for (const pattern of ABRUPT_ENDINGS) {
    result = result.replace(pattern, "");
  }

  // Clean up resulting whitespace
  result = result.replace(/^\s+/, "").replace(/\s+$/, "");

  // Capitalize first letter if needed
  if (result && result[0] !== result[0].toUpperCase()) {
    result = result[0].toUpperCase() + result.slice(1);
  }

  return result;
}

/**
 * Smooth the opening of text based on context.
 */
function smoothOpening(text: string, input: VoiceTurnSmoothingInput): string {
  const entryMode = decideEntryMode(input);
  let result = text;

  // RULE A — direct/concise: compact opening, remove soft intro
  if (
    entryMode === "clean_direct_entry"
  ) {
    // Remove any remaining soft fillers
    const fillers = [/^\s*(ну\s*)/iu, /^\s*(так\s*)/iu, /^\s*(итак\s*)/iu, /^\s*(вот\s*)/iu];
    for (const f of fillers) {
      result = result.replace(f, "");
    }
    result = result.replace(/^\s+/, "");
    if (result && result[0] !== result[0].toUpperCase()) {
      result = result[0].toUpperCase() + result.slice(1);
    }
  }

  // RULE B — continuing/follow-up: soften reentry, avoid cold restart
  if (
    entryMode === "soft_continuation_entry" ||
    entryMode === "warm_reentry_entry"
  ) {
    // Trim abrupt openers that would feel like cold restart
    result = trimAbruptTurnEdges(result);
  }

  // RULE C — supportive: gentle entry
  if (entryMode === "supportive_gentle_entry") {
    result = trimAbruptTurnEdges(result);
  }

  return result || text; // fallback to original if emptied
}

/**
 * Smooth the ending of text based on context.
 */
function smoothEnding(text: string, input: VoiceTurnSmoothingInput): string {
  const exitMode = decideExitMode(input);
  let result = text;

  // RULE D — short practical answers: clean stop
  if (exitMode === "clean_stop") {
    // Remove trailing ellipsis (Unicode and ASCII), dangling punctuation
    result = result.replace(/\s*[\u2026]{3,}\s*$/u, "");
    result = result.replace(/\s*\.{3,}\s*$/u, "");
    result = result.replace(/\s*[,;]\s*$/u, "");
    result = result.replace(/\s*-\s*$/u, "");
    result = result.trim();
  }

  // RULE E — medium/long warm/continuing/guided: softer landing
  if (
    exitMode === "soft_landing" ||
    exitMode === "warm_hold"
  ) {
    // Remove harsh endings but keep natural closure
    result = result.replace(/\s*[\u2026]{3,}\s*$/u, ".");
    result = result.replace(/\s*\.{3,}\s*$/u, ".");
    result = result.replace(/\s*(и все[.!\s]*)$/iu, ".");
    result = result.replace(/\s*(и всё[.!\s]*)$/iu, ".");
    result = result.replace(/\s*(вот[.!\s]*)$/iu, ".");
    result = result.replace(/\s*[,;]\s*$/u, ".");
    result = result.replace(/\s*-\s*$/u, "");
    result = result.trim();
    if (result && !/[.!?…]$/.test(result)) {
      result += ".";
    }
  }

  // RULE C — supportive: non-harsh exit
  if (exitMode === "supportive_hold") {
    result = result.replace(/\s*(и все[.!\s]*)$/iu, ".");
    result = result.replace(/\s*(и всё[.!\s]*)$/iu, ".");
    result = result.replace(/\s*(вот[.!\s]*)$/iu, ".");
    result = result.replace(/\s*[,;]\s*$/u, ".");
    result = result.trim();
    if (result && !/[.!?…]$/.test(result)) {
      result += ".";
    }
  }

  return result || text;
}

/**
 * Decide entry mode based on context.
 */
function decideEntryMode(input: VoiceTurnSmoothingInput): VoiceTurnEntryMode {
  // RULE A — direct/concise → clean entry
  if (
    input.responseStyle === "concise" ||
    input.cadenceMode === "crisp_direct" ||
    input.assemblyMode === "direct_spoken"
  ) {
    return "clean_direct_entry";
  }

  // RULE C — supportive → gentle entry
  if (
    input.responseStyle === "supportive" ||
    input.cadenceMode === "supportive_gentle" ||
    input.assemblyMode === "supportive_spoken"
  ) {
    return "supportive_gentle_entry";
  }

  // RULE B — continuing/follow-up → soft continuation
  if (
    input.presenceMode === "continuing" ||
    input.presenceMode === "soft_followup" ||
    input.isFollowUp === true
  ) {
    return input.responseStyle === "warm" || input.cadenceMode === "warm_compact"
      ? "warm_reentry_entry"
      : "soft_continuation_entry";
  }

  // Default: clean direct entry for fresh/reset contexts
  return "clean_direct_entry";
}

/**
 * Decide exit mode based on context.
 */
function decideExitMode(input: VoiceTurnSmoothingInput): VoiceTurnExitMode {
  // RULE C — supportive contexts → supportive hold
  if (
    input.responseStyle === "supportive" ||
    input.cadenceMode === "supportive_gentle" ||
    input.assemblyMode === "supportive_spoken"
  ) {
    return "supportive_hold";
  }

  // RULE B — continuing/follow-up → warm hold or soft landing
  if (
    input.presenceMode === "continuing" ||
    input.presenceMode === "soft_followup" ||
    input.isFollowUp === true
  ) {
    if (input.responseStyle === "warm" || input.cadenceMode === "warm_compact") {
      return "warm_hold";
    }
    return "soft_landing";
  }

// RULE D — short practical answers → clean stop
  const compareStyle = input.responseStyle as string;
  const compareCadence = input.cadenceMode as string;
  if (
    input.answerLength === "short" &&
    compareStyle !== "supportive" &&
    compareCadence !== "supportive_gentle"
  ) {
    return "clean_stop";
  }

  // RULE E — medium/long warm/continuing/guided → soft landing
  const isMediumOrLong = input.answerLength === "medium" || input.answerLength === "long";
  const hasWarmStyle = input.responseStyle === "warm";
  const comparePresence = input.presenceMode as string;
  const hasContinuing = comparePresence === "continuing";
  const hasSoftGuided = input.cadenceMode === "soft_guided";
  const hasSteady = input.cadenceMode === "steady_explanatory";
  if (isMediumOrLong && (hasWarmStyle || hasContinuing || hasSoftGuided || hasSteady)) {
    return "soft_landing";
  }

  // Default: clean stop for direct/concise contexts
  return "clean_stop";
}

// ============================================================================
// Main smoothing function
// ============================================================================

/**
 * Smooth voice turn entry and exit.
 * Pure function — deterministic, debuggable.
 */
export function smoothVoiceTurn(
  input: VoiceTurnSmoothingInput,
): VoiceTurnSmoothingDecision {
  const entryMode = decideEntryMode(input);
  const exitMode = decideExitMode(input);
  const hints: string[] = [];
  const warnings: string[] = [];

  // Apply opening smoothing
  const afterOpening = smoothOpening(input.text, input);

  // Apply ending smoothing
  const smoothedText = smoothEnding(afterOpening, input);

  // Determine flags
  const shouldSoftenEntry =
    entryMode === "soft_continuation_entry" ||
    entryMode === "warm_reentry_entry" ||
    entryMode === "supportive_gentle_entry";

  const shouldCompactEntry = entryMode === "clean_direct_entry";

  const shouldSoftenEnding =
    exitMode === "soft_landing" ||
    exitMode === "warm_hold" ||
    exitMode === "supportive_hold";

  const shouldKeepEndingClean = exitMode === "clean_stop";

  // Build hints
  if (shouldCompactEntry) {
    hints.push("entry_compacted_for_direct_mode");
  }

  if (shouldSoftenEntry) {
    hints.push("continuation_entry_softened");
  }

  if (exitMode === "supportive_hold") {
    hints.push("supportive_exit_softened");
  }

  if (smoothedText !== input.text) {
    hints.push("turn_edges_smoothed");
    hints.push("ending_cleaned_for_voice");
  }

  // Build warnings
  // Check if original opening was abrupt
  for (const pattern of ABRUPT_OPENERS) {
    if (pattern.test(input.text)) {
      warnings.push("source_opening_too_abrupt");
      break;
    }
  }

  // Check if original ending was abrupt
  for (const pattern of ABRUPT_ENDINGS) {
    if (pattern.test(input.text)) {
      warnings.push("source_ending_too_abrupt");
      break;
    }
  }

  // Supportive context risk
  if (
    (input.responseStyle === "supportive" || input.cadenceMode === "supportive_gentle") &&
    exitMode === "clean_stop"
  ) {
    warnings.push("supportive_context_risk_of_hard_cut");
  }

  // Follow-up shouldn't restart cold
  if (
    (input.presenceMode === "continuing" || input.isFollowUp === true) &&
    entryMode === "clean_direct_entry"
  ) {
    warnings.push("followup_should_not_restart_cold");
  }

  // Edges were needed
  if (smoothedText !== input.text) {
    warnings.push("turn_edges_needed_cleanup");
  }

  return {
    entryMode,
    exitMode,
    smoothedText,
    shouldSoftenEntry,
    shouldCompactEntry,
    shouldSoftenEnding,
    shouldKeepEndingClean,
    hints,
    warnings,
  };
}
