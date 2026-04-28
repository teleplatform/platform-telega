// ─────────────────────────────────────────────────────────────
// VOICE SURFACE RESPONSE CONTRACT v1.0 — Truthful Status Enforcement
//
// Core law: No surface may turn prepared into executed,
// handedOff into delivered, reviewRequired into error.
// ─────────────────────────────────────────────────────────────

import type { TruthBehaviorContract, VoiceSurfaceResponseContract } from "./types.js";

export function forbidFakeCompletion(contract: VoiceSurfaceResponseContract): boolean {
  return contract.truthBehavior.forbidFakeCompletion;
}

export function forbidPreparedAsExecuted(contract: VoiceSurfaceResponseContract): boolean {
  return contract.truthBehavior.forbidPreparedAsExecuted;
}

export function forbidHandoffAsDelivered(contract: VoiceSurfaceResponseContract): boolean {
  return contract.truthBehavior.forbidHandoffAsDelivered;
}

export function requireTruthfulStatusLanguage(contract: VoiceSurfaceResponseContract): boolean {
  return contract.truthBehavior.requireTruthfulStatusLanguage;
}

export function preferExplicitBlockedExplanation(contract: VoiceSurfaceResponseContract): boolean {
  return contract.truthBehavior.preferExplicitBlockedExplanation;
}

// -- Completion-like words that must NOT appear in "prepared" context --
const COMPLETION_WORDS = [
  "executed", "done", "complete", "finished", "accomplished",
  "выполнено", "готово", "завершено", "сделано",
  "bajarildi", "tayyor", "tugallandi",
];

// -- Handoff-like words that must NOT appear as "delivered" --
const DELIVERED_WORDS = [
  "delivered", "received", "handed over",
  "доставлено", "получено", "передано",
  "yetkazildi", "qabul qilindi",
];

export function checkTruthfulWording(text: string, status: string, contract: VoiceSurfaceResponseContract): string[] {
  const violations: string[] = [];
  const lower = text.toLowerCase();

  // No fake completion
  if (contract.truthBehavior.forbidFakeCompletion && status === "prepared") {
    for (const word of COMPLETION_WORDS) {
      if (lower.includes(word)) {
        violations.push(`Fake completion detected in "prepared" context: "${word}"`);
      }
    }
  }

  // Prepared ≠ executed
  if (contract.truthBehavior.forbidPreparedAsExecuted && status === "prepared") {
    if (lower.includes("executed") || lower.includes("выполнено") || lower.includes("bajarildi")) {
      violations.push('"prepared" must not sound like "executed"');
    }
  }

  // Handoff ≠ delivered
  if (contract.truthBehavior.forbidHandoffAsDelivered && status === "handedOff") {
    for (const word of DELIVERED_WORDS) {
      if (lower.includes(word)) {
        violations.push(`Handoff must not sound like delivered: "${word}"`);
      }
    }
  }

  return violations;
}
