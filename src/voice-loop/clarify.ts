// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Clarify Behavior
//
// If meaning is unclear, Arisha must clarify — briefly, with
// one question, not a cascade of three clarifications in a row.
// ─────────────────────────────────────────────────────────────

import type {
  VoiceInteractionLoopContract,
  ConversationLoopState,
} from "./types.js";

export function clarifyOnLowConfidence(contract: VoiceInteractionLoopContract): boolean {
  return contract.clarifyBehavior.clarifyOnLowConfidence;
}

export function clarifyOnProtectedMeaning(contract: VoiceInteractionLoopContract): boolean {
  return contract.clarifyBehavior.clarifyOnProtectedMeaning;
}

export function getMaxClarificationsPerTurn(contract: VoiceInteractionLoopContract): number {
  return contract.clarifyBehavior.maxClarificationsPerTurn;
}

export function preferSingleClarifyingQuestion(contract: VoiceInteractionLoopContract): boolean {
  return contract.clarifyBehavior.preferSingleClarifyingQuestion;
}

export function shouldClarify(
  contract: VoiceInteractionLoopContract,
  state: ConversationLoopState,
  confidence: number,
  isProtectedMeaning: boolean,
): boolean {
  // Already clarified this turn
  if (state.lastClarificationTurn === state.turnCount) return false;

  // Low confidence
  if (confidence < 0.5 && contract.clarifyBehavior.clarifyOnLowConfidence) return true;

  // Protected meaning uncertainty
  if (isProtectedMeaning && contract.clarifyBehavior.clarifyOnProtectedMeaning) return true;

  return false;
}

export function canClarifyAgain(
  contract: VoiceInteractionLoopContract,
  state: ConversationLoopState,
): boolean {
  // Check if we already clarified THIS turn
  const alreadyClarifiedThisTurn = state.lastClarificationTurn === state.turnCount;
  if (alreadyClarifiedThisTurn) {
    return false;
  }
  // Otherwise we can clarify (maxClarificationsPerTurn is per-turn)
  return true;
}

// -- Clarification phrases --
const CLARIFY_PHRASES = {
  ru: [
    "Уточни, пожалуйста?",
    "Что именно ты имеешь в виду?",
    "Можешь переформулировать?",
    "Я не уверена — повтори, пожалуйста?",
    "Поясни чуть подробнее?",
  ],
  en: [
    "Could you clarify?",
    "What do you mean exactly?",
    "Can you rephrase that?",
    "I'm not sure — could you repeat?",
    "Can you explain a bit more?",
  ],
  uz: [
    "Aniqlashtirib ayta olasizmi?",
    "Aynan nima nazarda tutyapsiz?",
    "Boshqacha aytib berasizmi?",
    "Ishonchim komil emas — qaytarib ayta olasizmi?",
    "Batafsilroq tushuntira olasizmi?",
  ],
};

export function pickClarifyingPhrase(language: "ru" | "en" | "uz"): string {
  const phrases = CLARIFY_PHRASES[language];
  return phrases[Math.floor(Math.random() * phrases.length)];
}
