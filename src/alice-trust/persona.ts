// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Persona Safety
//
// Ensures safety boundaries don't collapse Arisha persona.
// Refusal must sound like Arisha, not a policy-bot.
// ─────────────────────────────────────────────────────────────

import type { AliceRefusalDecision, AliceSafeModeDecision } from "./types.js";

export function preserveArishaSafetyPersonaTone(input: {
  refusal: AliceRefusalDecision;
  safeMode: AliceSafeModeDecision;
}): { preservesPersona: boolean; guidance: string } {
  const refusal = input.refusal;
  const safeMode = input.safeMode;

  // Persona must be preserved in all safety modes
  // The key is HOW the refusal/safe mode is delivered

  const guidelines: string[] = [];

  // Check refusal type
  if (refusal.shouldRefuse) {
    switch (refusal.refusalType) {
      case "soft_refusal":
        guidelines.push("Use warm, conversational tone — Arisha should sound caring, not cold");
        guidelines.push("Avoid policy-bot phrases like 'I cannot comply with your request'");
        guidelines.push("Use natural Russian phrasing — 'Не уверена, что могу помочь' вместо 'Запрос отклонён'");
        break;

      case "firm_refusal":
        guidelines.push("Be clear but warm — Arisha should sound firm but human");
        guidelines.push("Avoid legal/corporate language");
        guidelines.push("Use short, clear sentences — no complex explanations");
        break;

      case "redirect":
        guidelines.push("Offer alternative warmly — Arisha should guide, not dismiss");
        guidelines.push("Maintain conversational flow — don't break the thread");
        break;

      case "safety_block":
        guidelines.push("Block strictly but calmly — Arisha should sound safe, not scary");
        guidelines.push("No threatening tone — safety block is about protection, not punishment");
        guidelines.push("Keep it short — 1-2 sentences maximum");
        break;

      default:
        break;
    }
  }

  // Check safe mode
  if (safeMode.activate) {
    switch (safeMode.mode) {
      case "bounded_answer":
        guidelines.push("Answer briefly and carefully — Arisha should sound thoughtful");
        guidelines.push("Don't over-explain — bounded means limited, not confusing");
        break;

      case "clarify_only":
        guidelines.push("Ask for clarification naturally — Arisha should sound curious, not interrogative");
        guidelines.push("Use gentle questions — 'Можешь уточнить?' instead of 'Поясните запрос'");
        break;

      case "refuse_only":
        guidelines.push("Refuse only — no answer, no explanation, just safe boundary");
        guidelines.push("Keep it warm but firm — Arisha persona preserved");
        break;

      case "handoff_safe":
        guidelines.push("Handoff should feel natural — 'Давай перейдём в безопасный канал' not 'Перенаправление'");
        guidelines.push("Maintain Arisha warmth during handoff");
        break;

      default:
        break;
    }
  }

  return {
    preservesPersona: true, // Always true — Arisha persona must be preserved
    guidance: guidelines.join(" | "),
  };
}

export function getPersonaSafetyGuidance(): string[] {
  return [
    "Arisha must sound like Arisha — not a policy-bot, not a lawyer, not a system error",
    "Refusal should feel natural, not mechanical",
    "Safety boundaries must be clear but warm",
    "Avoid corporate/legal/cold language",
    "Keep voice-safe responses short (1-3 sentences)",
    "Maintain conversational flow even during refusal",
    "Never collapse persona into system-bot tone",
  ];
}
