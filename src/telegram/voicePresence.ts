/**
 * Voice Presence / Relationship Layer v1.0
 *
 * Bounded short-arc conversational continuity — NOT a memory system.
 * Adjusts delivery slightly based on recent interaction context.
 *
 * Presence modes:
 *   fresh         — first interaction, no continuity
 *   continuing    — natural follow-up to previous exchange
 *   soft_followup — gentle continuation after supportive/warm exchange
 *   reset         — conversation reset (unrelated input / long gap)
 *
 * This layer does NOT:
 *   - Persist long-term user data
 *   - Create personal profiles
 *   - Track emotional states
 *   - Simulate memory beyond short window
 *   - Override style or strategy decisions
 */

import type { VoiceStyleMode } from "./voiceStyle.js";

export type PresenceMode = "fresh" | "continuing" | "soft_followup" | "reset";

/** Short-window presence context — ephemeral, no DB storage */
export interface PresenceContext {
  /** Last interaction type (greeting / support / neutral / concise) */
  lastInteractionType: "greeting" | "support" | "neutral" | "concise" | null;
  /** Last style mode used */
  lastStyleMode: VoiceStyleMode | null;
  /** Whether last response was voice */
  lastResponseWasVoice: boolean;
  /** Bounded interaction count (0-5 per session window) */
  interactionCount: number;
  /** Timestamp of last interaction */
  lastInteractionAt: number;
}

export interface PresenceResult {
  mode: PresenceMode;
  reason: string;
  /** Whether text shaping was applied */
  textAdjusted: boolean;
  /** Shaped text (may equal original if no shaping needed) */
  shapedText: string;
}

/** Create a fresh presence context (no history) */
export function createFreshContext(): PresenceContext {
  return {
    lastInteractionType: null,
    lastStyleMode: null,
    lastResponseWasVoice: false,
    interactionCount: 0,
    lastInteractionAt: 0,
  };
}

/**
 * Decide presence mode based on current input + last context.
 * Pure function — no side effects.
 */
export function decidePresenceMode(
  inputText: string,
  styleMode: VoiceStyleMode,
  ctx: PresenceContext,
): PresenceMode {
  const trimmed = inputText.trim().toLowerCase();

  // Reset conditions:
  // 1. Long gap since last interaction (> 5 minutes)
  const gapMs = Date.now() - ctx.lastInteractionAt;
  if (ctx.lastInteractionAt > 0 && gapMs > 5 * 60 * 1000) {
    return "reset";
  }

  // 2. Unrelated input after support — user changed topic
  if (ctx.lastInteractionType === "support" && styleMode !== "supportive" && styleMode !== "warm") {
    // Check if input is clearly a new topic (contains question mark or topic shift words)
    if (/\?|расскажи|что думаешь|как насчет|а что/.test(trimmed)) {
      return "reset";
    }
  }

  // 3. Fresh start: no history
  if (ctx.lastInteractionType === null || ctx.interactionCount === 0) {
    return "fresh";
  }

  // 4. Continuing: natural follow-up
  if (styleMode === "warm" && ctx.lastStyleMode === "warm") {
    // Back-to-back greetings → continuing
    return "continuing";
  }

  // 5. Soft follow-up: after supportive exchange, user responds softly
  if (ctx.lastStyleMode === "supportive" && (styleMode === "concise" || styleMode === "neutral")) {
    // User acknowledged support → soft follow-up
    return "soft_followup";
  }

  // 6. Continuing: same style repeated naturally
  if (ctx.lastStyleMode === styleMode && ctx.interactionCount < 3) {
    return "continuing";
  }

  // 7. Default: continuing for most cases with history
  return ctx.interactionCount > 0 ? "continuing" : "fresh";
}

/**
 * Apply light text shaping based on presence mode.
 * Does NOT change meaning, add facts, or expand scope.
 */
export function applyPresenceShaping(
  text: string,
  presence: PresenceMode,
  styleMode: VoiceStyleMode,
  ctx: PresenceContext,
): PresenceResult {
  const trimmed = text.trim();

  // Fresh: no shaping needed
  if (presence === "fresh") {
    return {
      mode: presence,
      reason: "fresh_no_shaping",
      textAdjusted: false,
      shapedText: trimmed,
    };
  }

  // Reset: no shaping, clean slate
  if (presence === "reset") {
    return {
      mode: presence,
      reason: "reset_no_shaping",
      textAdjusted: false,
      shapedText: trimmed,
    };
  }

  // Continuing: avoid repeating exact opening patterns
  if (presence === "continuing") {
    // If last response was voice and this is also voice, avoid identical openings
    if (ctx.lastResponseWasVoice) {
      // Remove common repeated openers if text starts with them
      const repeatedOpeners = ["Привет! ", "Здравствуй! ", "Принято. ", "Хорошо. "];
      let shaped = trimmed;
      for (const opener of repeatedOpeners) {
        if (shaped.startsWith(opener) && ctx.interactionCount >= 2) {
          shaped = shaped.slice(opener.length);
          return {
            mode: presence,
            reason: "removed_repeated_opener",
            textAdjusted: true,
            shapedText: shaped,
          };
        }
      }
    }

    return {
      mode: presence,
      reason: "continuing_no_change_needed",
      textAdjusted: false,
      shapedText: trimmed,
    };
  }

  // Soft follow-up: slightly soften phrasing after supportive exchange
  if (presence === "soft_followup") {
    // Don't add emotional content — just ensure concise delivery
    if (styleMode === "concise" && trimmed.length > 50) {
      // Keep it brief
      const shortened = trimmed.length > 80 ? trimmed.slice(0, 80) + "..." : trimmed;
      return {
        mode: presence,
        reason: "soft_followup_brief",
        textAdjusted: true,
        shapedText: shortened,
      };
    }

    return {
      mode: presence,
      reason: "soft_followup_no_change",
      textAdjusted: false,
      shapedText: trimmed,
    };
  }

  // Default: no shaping
  return {
    mode: "fresh",
    reason: "default_no_shaping",
    textAdjusted: false,
    shapedText: trimmed,
  };
}

/**
 * Update presence context after a response.
 * Returns updated context (immutable — does not mutate input).
 */
export function updateContextAfterResponse(
  ctx: PresenceContext,
  interactionType: "greeting" | "support" | "neutral" | "concise",
  styleMode: VoiceStyleMode,
  wasVoice: boolean,
): PresenceContext {
  return {
    lastInteractionType: interactionType,
    lastStyleMode: styleMode,
    lastResponseWasVoice: wasVoice,
    interactionCount: Math.min(ctx.interactionCount + 1, 5),
    lastInteractionAt: Date.now(),
  };
}

/** Classify interaction type from input text (lightweight, no ML) */
export function classifyInteractionType(text: string): "greeting" | "support" | "neutral" | "concise" {
  const lower = text.trim().toLowerCase();

  if (/^(привет|здравствуй|добрый\s+(день|утро|вечер)|хай|хей|hello|hi|hey)/iu.test(lower)) {
    return "greeting";
  }

  if (/поддержк|тяжело|страшно|грустно|помоги|помогите|нужна поддержка/iu.test(lower)) {
    return "support";
  }

  if (lower.length < 30 && /^(ok|ок|да$|нет$|ага|угу|ладно|ясно|понял|сделано|готово)/iu.test(lower)) {
    return "concise";
  }

  return "neutral";
}
