// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Interruption Recovery
//
// If user interrupts: stop current turn, recover softly,
// briefly restore context, continue — no long retelling.
// ─────────────────────────────────────────────────────────────

import type { VoiceInteractionLoopContract, VoiceInterruptionLoopContract } from "./types.js";

export function supportsBargeIn(contract: VoiceInteractionLoopContract): boolean {
  return contract.interruptionBehavior.supportsBargeIn;
}

export function stopCurrentTurnOnInterrupt(contract: VoiceInteractionLoopContract): boolean {
  return contract.interruptionBehavior.stopCurrentTurnOnInterrupt;
}

export function recoverSoftly(contract: VoiceInteractionLoopContract): boolean {
  return contract.interruptionBehavior.recoverSoftly;
}

export function getMaxRecoverySentences(contract: VoiceInteractionLoopContract): number {
  return contract.interruptionBehavior.maxRecoverySentences;
}

export function restateOnlyMinimalContext(contract: VoiceInteractionLoopContract): boolean {
  return contract.interruptionBehavior.restateOnlyMinimalContext;
}

// -- Recovery phrases --
const RECOVERY_PHRASES = {
  ru: [
    "Так, на чём мы остановились?",
    "Вернёмся к делу.",
    "Мы говорили о задаче — продолжим?",
    "Давай вернёмся к тому, что обсуждали.",
  ],
  en: [
    "Where were we?",
    "Let's get back to it.",
    "We were discussing the task — shall we continue?",
    "Let me get back to what we were talking about.",
  ],
  uz: [
    "Nima haqida gaplashayotgan edik?",
    "Ishga qaytaylik.",
    "Vazifa haqida gaplashayotgan edik — davom etamizmi?",
    "Muhokama qilayotgan mavzuga qaytaylik.",
  ],
};

export function pickRecoveryPhrase(language: "ru" | "en" | "uz"): string {
  const phrases = RECOVERY_PHRASES[language];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

export function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  return matches ? matches.length : (text.trim().length > 0 ? 1 : 0);
}

export function validateRecoveryPhrase(phrase: string, maxSentences: number): boolean {
  return countSentences(phrase) <= maxSentences;
}
