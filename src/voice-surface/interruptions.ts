// ─────────────────────────────────────────────────────────────
// VOICE SURFACE RESPONSE CONTRACT v1.0 — Interruption Behavior
//
// After interruption: softly recover, briefly restate context,
// no drama, no "sorry for the inconvenience", no dry tech support.
// ─────────────────────────────────────────────────────────────

import type { InterruptionBehaviorContract, VoiceSurfaceResponseContract } from "./types.js";

export function supportsInterruption(contract: VoiceSurfaceResponseContract): boolean {
  return contract.interruptionBehavior.supportsInterruption;
}

export function restartSoftlyAfterInterruption(contract: VoiceSurfaceResponseContract): boolean {
  return contract.interruptionBehavior.restartSoftlyAfterInterruption;
}

export function restateContextBriefly(contract: VoiceSurfaceResponseContract): boolean {
  return contract.interruptionBehavior.restateContextBriefly;
}

export function getMaxRecoverySentences(contract: VoiceSurfaceResponseContract): number {
  return contract.interruptionBehavior.maxRecoverySentences;
}

// -- Recovery phrase banks --
const RECOVERY_PHRASES = {
  ru: [
    "Так, на чём мы остановились?",
    "Вернёмся к тому, что обсуждали.",
    "Мы говорили о задаче — продолжим?",
    "Давай вернёмся к делу.",
  ],
  en: [
    "Where were we?",
    "Let me get back to what we were discussing.",
    "We were talking about the task — shall we continue?",
    "Let's get back to it.",
  ],
  uz: [
    "Nima haqida gaplashayotgan edik?",
    "Muhokama qilayotgan mavzuga qaytaylik.",
    "Vazifa haqida gaplashayotgan edik — davom etamizmi?",
    "Ishga qaytaylik.",
  ],
};

export function pickRecoveryPhrase(language: "ru" | "en" | "uz"): string {
  const phrases = RECOVERY_PHRASES[language];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

export function validateRecoveryPhrase(phrase: string, maxSentences: number): boolean {
  const sentences = phrase.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return sentences.length <= maxSentences;
}
