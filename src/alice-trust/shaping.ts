// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Voice-Safe Shaping
//
// Shapes responses to be voice-safe:
// - short, clear, non-threatening
// - not cold or system-bot-like
// - bounded and human
// ─────────────────────────────────────────────────────────────

import type { AliceVoiceSafeShape, AliceRefusalDecision } from "./types.js";
import { REFUSAL_PHRASES } from "./refusal.js";

export function buildAliceVoiceSafeShape(input: {
  refusal: AliceRefusalDecision;
  customText?: string;
  maxWords?: number;
}): AliceVoiceSafeShape {
  const maxWords = input.maxWords ?? 15;
  const refusal = input.refusal;

  // If refusal, use refusal phrases
  if (refusal.shouldRefuse) {
    const phrases = REFUSAL_PHRASES[refusal.refusalType];
    if (phrases.length > 0) {
      const text = phrases[Math.floor(Math.random() * phrases.length)];
      const wordCount = text.split(/\s+/).length;
      return {
        text,
        tone: getToneForRefusalType(refusal.refusalType),
        wordCount,
        preservesPersona: true,
      };
    }
  }

  // If custom text provided, use it
  if (input.customText) {
    const text = input.customText;
    const wordCount = text.split(/\s+/).length;
    return {
      text,
      tone: "warm_bounded",
      wordCount,
      preservesPersona: true,
    };
  }

  // Default bounded response
  const defaultText = "Я не могу это обсудить — давай попробуем иначе.";
  return {
    text: defaultText,
    tone: "warm_bounded",
    wordCount: defaultText.split(/\s+/).length,
    preservesPersona: true,
  };
}

function getToneForRefusalType(refusalType: AliceRefusalDecision["refusalType"]): AliceVoiceSafeShape["tone"] {
  switch (refusalType) {
    case "soft_refusal":
      return "warm_bounded";
    case "firm_refusal":
      return "firm_refusal";
    case "redirect":
      return "redirect_calm";
    case "safety_block":
      return "safety_block_calm";
    default:
      return "warm_bounded";
  }
}

export function getShapeToneDescription(tone: AliceVoiceSafeShape["tone"]): string {
  switch (tone) {
    case "warm_bounded":
      return "Warm but bounded — Arisha stays warm while maintaining boundary";
    case "firm_refusal":
      return "Firm refusal — clear boundary, cannot fulfill, but persona-preserving";
    case "redirect_calm":
      return "Redirect calm — offering safe alternative with calm, warm tone";
    case "safety_block_calm":
      return "Safety block calm — strict but calm, human tone, no system-bot feel";
    default:
      return `Unknown tone: ${tone}`;
  }
}
