// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Selectors
//
// getVoiceLoopContract()
// getMaxClarificationsPerTurn()
// supportsBargeIn()
// getMaxRecoverySentences()
// getMaxContextCarryTurns()
// shouldAcknowledgeBeforeThinking()
// ─────────────────────────────────────────────────────────────

import type { VoiceInteractionLoopContract } from "./types.js";

let _contract: VoiceInteractionLoopContract | null = null;

export function setVoiceLoopContract(contract: VoiceInteractionLoopContract): void {
  _contract = contract;
}

export function getVoiceLoopContract(): VoiceInteractionLoopContract | null {
  return _contract;
}

export function getMaxClarificationsPerTurn(): number | undefined {
  return _contract?.clarifyBehavior.maxClarificationsPerTurn;
}

export function supportsBargeIn(): boolean | undefined {
  return _contract?.interruptionBehavior.supportsBargeIn;
}

export function getMaxRecoverySentences(): number | undefined {
  return _contract?.interruptionBehavior.maxRecoverySentences;
}

export function getMaxContextCarryTurns(): number | undefined {
  return _contract?.memoryBehavior.maxContextCarryTurns;
}

export function shouldAcknowledgeBeforeThinking(): boolean | undefined {
  return _contract?.acknowledgeBehavior.acknowledgeBeforeLongerThinking;
}

export function getMaxEntrySentences(): number | undefined {
  return _contract?.entryBehavior.maxEntrySentences;
}

export function getMaxAcknowledgeWords(): number | undefined {
  return _contract?.acknowledgeBehavior.maxAcknowledgeWords;
}

export function getMaxHoldingPhraseWords(): number | undefined {
  return _contract?.pauseBehavior.maxHoldingPhraseWords;
}

export function getMaxClosureSentences(): number | undefined {
  return _contract?.closureBehavior.maxClosureSentences;
}

export function supportsMultiTurn(): boolean | undefined {
  return _contract?.continuationBehavior.supportsMultiTurn;
}

export function getMaxSequentialTurns(): number | undefined {
  return _contract?.continuationBehavior.maxSequentialTurnsWithoutUserReset;
}
