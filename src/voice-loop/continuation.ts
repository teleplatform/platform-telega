// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Continuation Behavior
//
// Multi-turn voice dialogue is allowed but bounded:
// only if context is fresh, semantic thread intact,
// and previous step doesn't require review/pause/reset.
// ─────────────────────────────────────────────────────────────

import type { VoiceInteractionLoopContract, ConversationLoopState } from "./types.js";

export function supportsMultiTurn(contract: VoiceInteractionLoopContract): boolean {
  return contract.continuationBehavior.supportsMultiTurn;
}

export function continueOnlyIfContextFresh(contract: VoiceInteractionLoopContract): boolean {
  return contract.continuationBehavior.continueOnlyIfContextFresh;
}

export function getMaxSequentialTurnsWithoutUserReset(contract: VoiceInteractionLoopContract): number {
  return contract.continuationBehavior.maxSequentialTurnsWithoutUserReset;
}

export function preferOneNextStepAtATime(contract: VoiceInteractionLoopContract): boolean {
  return contract.continuationBehavior.preferOneNextStepAtATime;
}

export function canContinue(
  contract: VoiceInteractionLoopContract,
  state: ConversationLoopState,
): boolean {
  if (!contract.continuationBehavior.supportsMultiTurn) return false;
  if (contract.continuationBehavior.continueOnlyIfContextFresh && !state.contextFresh) return false;
  if (state.consecutiveSystemTurns >= contract.continuationBehavior.maxSequentialTurnsWithoutUserReset) return false;
  return true;
}
