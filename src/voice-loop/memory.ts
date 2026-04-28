// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Memory Behavior
//
// Short conversation memory, not infinite context tail.
// Remembers immediate turn context and short session context.
// Drops stale context gracefully.
// ─────────────────────────────────────────────────────────────

import type { VoiceInteractionLoopContract, ConversationLoopState } from "./types.js";

export function remembersImmediateTurnContext(contract: VoiceInteractionLoopContract): boolean {
  return contract.memoryBehavior.remembersImmediateTurnContext;
}

export function remembersShortSessionContext(contract: VoiceInteractionLoopContract): boolean {
  return contract.memoryBehavior.remembersShortSessionContext;
}

export function getMaxContextCarryTurns(contract: VoiceInteractionLoopContract): number {
  return contract.memoryBehavior.maxContextCarryTurns;
}

export function dropsStaleContextGracefully(contract: VoiceInteractionLoopContract): boolean {
  return contract.memoryBehavior.dropStaleContextGracefully;
}

export function shouldDropContext(contract: VoiceInteractionLoopContract, state: ConversationLoopState): boolean {
  return state.turnCount > contract.memoryBehavior.maxContextCarryTurns;
}

export function createContextRefreshPhrase(language: "ru" | "en" | "uz"): string {
  const phrases = {
    ru: ["Давай вернёмся к началу — что нужно сделать?", "Напомни, на чём мы остановились?"],
    en: ["Let's start fresh — what do you need?", "Remind me where we left off?"],
    uz: ["Boshidan boshlaylik — nima qilish kerak?", "Qayerda to'xtagan edik, eslatib yuborasizmi?"],
  };
  const pool = phrases[language];
  return pool[Math.floor(Math.random() * pool.length)];
}
