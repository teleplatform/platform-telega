// ─────────────────────────────────────────────────────────────
// VOICE SURFACE RESPONSE CONTRACT v1.0 — Latency-Aware Phrasing
//
// Short, living holding phrases. No "processing request" / "please wait".
// ─────────────────────────────────────────────────────────────

import type { LatencyBehaviorContract, HoldingPhraseBank, VoiceSurfaceResponseContract } from "./types.js";

export const HOLDING_PHRASES: HoldingPhraseBank = {
  ru: [
    "Смотрю.",
    "Секунду, проверю.",
    "Да, сейчас уточню.",
    "Подожди немного.",
    "Сейчас посмотрю.",
    "Минутку.",
    "Дай подумать.",
  ],
  en: [
    "One moment.",
    "Let me check that.",
    "Checking now.",
    "Give me a sec.",
    "Let me look into it.",
    "Just a moment.",
    "Thinking…",
  ],
  uz: [
    "Bir soniya, tekshiraman.",
    "Hozir qarayman.",
    "Kuting, tekshirib ko'raman.",
    "Bir daqiqa.",
    "Hozir o'ylab ko'ray.",
  ],
};

export function supportsHoldingPhrase(contract: VoiceSurfaceResponseContract): boolean {
  return contract.latencyBehavior.supportsShortHoldingPhrase;
}

export function allowsProgressiveResponse(contract: VoiceSurfaceResponseContract): boolean {
  return contract.latencyBehavior.allowsProgressiveResponse;
}

export function prefersFastAcknowledgeThenAnswer(contract: VoiceSurfaceResponseContract): boolean {
  return contract.latencyBehavior.prefersFastAcknowledgeThenAnswer;
}

export function getHoldingPhraseMaxWords(contract: VoiceSurfaceResponseContract): number {
  return contract.latencyBehavior.holdingPhraseMaxWords;
}

export function pickHoldingPhrase(language: "ru" | "en" | "uz"): string {
  const phrases = HOLDING_PHRASES[language];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

export function validateHoldingPhrase(phrase: string, maxWords: number): boolean {
  const words = phrase.trim().split(/\s+/).length;
  return words <= maxWords;
}
