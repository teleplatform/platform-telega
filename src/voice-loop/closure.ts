// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Closure Behavior
//
// Turn closure must be soft, short, appropriate:
// no abrupt endings, no over-friendly farewell spam.
// ─────────────────────────────────────────────────────────────

import type { VoiceInteractionLoopContract } from "./types.js";
import { countSentences } from "./timing.js";

export function supportsSoftClosure(contract: VoiceInteractionLoopContract): boolean {
  return contract.closureBehavior.supportsSoftClosure;
}

export function avoidsAbruptEndings(contract: VoiceInteractionLoopContract): boolean {
  return contract.closureBehavior.avoidAbruptEndings;
}

export function avoidsOverFriendlyFarewellSpam(contract: VoiceInteractionLoopContract): boolean {
  return contract.closureBehavior.avoidOverFriendlyFarewellSpam;
}

export function getMaxClosureSentences(contract: VoiceInteractionLoopContract): number {
  return contract.closureBehavior.maxClosureSentences;
}

// -- Closure phrases --
const CLOSURE_PHRASES = {
  ru: [
    "Хорошо, я на связи.",
    "Если что — обращайся.",
    "Буду здесь, если понадобится.",
    "Дай знать, если нужно ещё что-то.",
  ],
  en: [
    "I'm here if you need me.",
    "Let me know if there's anything else.",
    "I'll be around.",
    "Just say the word if you need more.",
  ],
  uz: [
    "Kerak bo'lsa — men bu yerdaman.",
    "Yana biror narsa kerak bo'lsa — ayting.",
    "Bu yerdaman, murojaat qiling.",
    "Yana savol bo'lsa — yozing.",
  ],
};

export function pickClosurePhrase(language: "ru" | "en" | "uz"): string {
  const phrases = CLOSURE_PHRASES[language];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

export function validateClosurePhrase(phrase: string, maxSentences: number): boolean {
  return countSentences(phrase) <= maxSentences;
}
