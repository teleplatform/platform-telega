// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Acknowledge Behavior
//
// If system needs time, it must give a short living acknowledge
// signal rather than silence or mechanical placeholder.
// ─────────────────────────────────────────────────────────────

import type { VoiceAcknowledgeBehaviorContract, VoiceInteractionLoopContract } from "./types.js";
import { countWords } from "./timing.js";

export function shouldAcknowledgeBeforeThinking(contract: VoiceInteractionLoopContract): boolean {
  return contract.acknowledgeBehavior.acknowledgeBeforeLongerThinking;
}

export function supportsLiveHoldingPhrase(contract: VoiceInteractionLoopContract): boolean {
  return contract.acknowledgeBehavior.supportsLiveHoldingPhrase;
}

export function avoidsMechanicalAcknowledgements(contract: VoiceInteractionLoopContract): boolean {
  return contract.acknowledgeBehavior.avoidMechanicalAcknowledgements;
}

export function getMaxAcknowledgeWords(contract: VoiceInteractionLoopContract): number {
  return contract.acknowledgeBehavior.maxAcknowledgeWords;
}

// -- Acknowledge phrase banks --
const ACKNOWLEDGE_PHRASES = {
  ru: [
    "Да, сейчас.",
    "Поняла, проверяю.",
    "Смотрю.",
    "Хорошо, сейчас.",
    "Поняла.",
    "Секунду.",
  ],
  en: [
    "Got it, checking.",
    "On it.",
    "Looking into it.",
    "Sure, one moment.",
    "Got it.",
    "Checking now.",
  ],
  uz: [
    "Tushundim, tekshiraman.",
    "Hozir qarayman.",
    "Ko'rib chiqaman.",
    "Yaxshi, hozir.",
    "Tushundim.",
    "Bir soniya.",
  ],
};

export function pickAcknowledgePhrase(language: "ru" | "en" | "uz", maxWords: number): string {
  const phrases = ACKNOWLEDGE_PHRASES[language].filter((p) => countWords(p) <= maxWords);
  const fallback = ACKNOWLEDGE_PHRASES[language];
  const pool = phrases.length > 0 ? phrases : fallback;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function validateAcknowledgePhrase(phrase: string, maxWords: number): boolean {
  return countWords(phrase) <= maxWords;
}
