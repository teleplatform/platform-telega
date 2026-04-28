// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Refusal Discipline
//
// Bounded refusal discipline.
// Types: none, soft_refusal, firm_refusal, redirect, safety_block
// Refusal must preserve Arisha persona — not cold/system-bot-like.
// ─────────────────────────────────────────────────────────────

import type { AliceRefusalDecision, AliceConversationRiskClass } from "./types.js";

export function buildAliceRefusalDecision(input: {
  riskClass: AliceConversationRiskClass;
  contextHints?: string[];
}): AliceRefusalDecision {
  const riskClass = input.riskClass;

  switch (riskClass) {
    case "safe":
      return {
        shouldRefuse: false,
        refusalType: "none",
        reason: "No refusal needed — request is safe",
      };

    case "sensitive":
      return {
        shouldRefuse: false,
        refusalType: "redirect",
        reason: "Sensitive content — redirecting to safe framing",
        notes: ["Maintain persona warmth while redirecting"],
      };

    case "unsafe":
      return {
        shouldRefuse: true,
        refusalType: "firm_refusal",
        reason: "Unsafe request — firm refusal with persona-preserving tone",
        notes: ["Refuse clearly but warmly — stay Arisha"],
      };

    case "high_risk":
      return {
        shouldRefuse: true,
        refusalType: "safety_block",
        reason: "High risk request — safety block with calm tone",
        notes: ["Block strictly — no ambiguity, but remain human"],
      };

    case "unknown":
      return {
        shouldRefuse: true,
        refusalType: "soft_refusal",
        reason: "Unknown risk — soft refusal with clarification path",
        notes: ["Gently decline while seeking clarification"],
      };

    default:
      return {
        shouldRefuse: true,
        refusalType: "safety_block",
        reason: `Unknown risk class: ${riskClass} — defaulting to safety block`,
      };
  }
}

export function getRefusalTypeDescription(type: AliceRefusalDecision["refusalType"]): string {
  switch (type) {
    case "none":
      return "No refusal — request is safe to fulfill";
    case "soft_refusal":
      return "Soft refusal — gentle decline with clarification path, warm tone";
    case "firm_refusal":
      return "Firm refusal — clear boundary, cannot fulfill, but persona-preserving";
    case "redirect":
      return "Redirect — cannot address directly, offering safe alternative framing";
    case "safety_block":
      return "Safety block — strict refusal due to high risk, calm but firm";
    default:
      return `Unknown refusal type: ${type}`;
  }
}

// -- Voice-safe refusal phrases (RU primary, EN/UZ placeholders) --
export const REFUSAL_PHRASES: Record<AliceRefusalDecision["refusalType"], string[]> = {
  none: [],
  soft_refusal: [
    "Не уверена, что могу помочь с этим — давай попробуем иначе.",
    "Мне сложно ответить на это — может, переформулируем?",
    "Я не совсем могу это обсудить — но я рядом, если нужно другое.",
  ],
  firm_refusal: [
    "Я не могу помочь с этим — это выходит за мои границы.",
    "Мне нельзя это обсуждать — но я могу поддержать в другом.",
    "Это вне моих границ безопасности — давай о чём-то другом.",
  ],
  redirect: [
    "Я могу посмотреть на это с другой стороны — хочешь?",
    "Давай подойдём к этому иначе — так будет безопаснее.",
    "Могу предложить более безопасный взгляд — попробуем?",
  ],
  safety_block: [
    "Я не могу это обсудить — это небезопасно.",
    "Мне нельзя помогать с этим — давай поговорим о другом.",
    "Это за пределами безопасности — я здесь, если нужно что-то другое.",
  ],
};
