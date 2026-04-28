// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Pause Behavior
//
// Voice system must be able to hold a short human pause
// rather than flooding it with unnecessary words.
// ─────────────────────────────────────────────────────────────

import type { VoiceInteractionLoopContract } from "./types.js";
import { countWords } from "./timing.js";

export function allowsMicroPause(contract: VoiceInteractionLoopContract): boolean {
  return contract.pauseBehavior.allowsMicroPause;
}

export function allowsThinkingPause(contract: VoiceInteractionLoopContract): boolean {
  return contract.pauseBehavior.allowsThinkingPause;
}

export function prefersShortPauseOverLongExplanation(contract: VoiceInteractionLoopContract): boolean {
  return contract.pauseBehavior.preferShortPauseOverLongExplanation;
}

export function getMaxHoldingPhraseWords(contract: VoiceInteractionLoopContract): number {
  return contract.pauseBehavior.maxHoldingPhraseWords;
}

// -- Short holding phrases --
const HOLDING_PHRASES = {
  ru: ["Секунду.", "Минутку.", "Подожди.", "Сейчас.", "Дай подумать."],
  en: ["One moment.", "Just a sec.", "Give me a moment.", "Thinking…", "Hold on."],
  uz: ["Bir soniya.", "Kuting.", "Bir daqiqa.", "Hozir.", "O'ylab ko'ray."],
};

export function pickHoldingPhrase(language: "ru" | "en" | "uz", maxWords: number): string {
  const phrases = HOLDING_PHRASES[language].filter((p) => countWords(p) <= maxWords);
  return phrases.length > 0 ? phrases[Math.floor(Math.random() * phrases.length)] : HOLDING_PHRASES[language][0];
}
