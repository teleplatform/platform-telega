// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — Selectors
//
// getVoiceRuntimeStateMachine()
// isTransitionAllowed(from, to)
// getAllowedNextStates(state)
// supportsPauseResume()
// supportsInterruptionRecovery()
// getMaxClarificationsPerTurn()
// getMaxRecoveryTurns()
// ─────────────────────────────────────────────────────────────

import type { VoiceRuntimeStateMachine, VoiceRuntimeState } from "./types.js";

let _machine: VoiceRuntimeStateMachine | null = null;

export function setVoiceRuntimeStateMachine(machine: VoiceRuntimeStateMachine): void {
  _machine = machine;
}

export function getVoiceRuntimeStateMachine(): VoiceRuntimeStateMachine | null {
  return _machine;
}

export function isTransitionAllowedSelector(from: VoiceRuntimeState, to: VoiceRuntimeState): boolean | undefined {
  if (!_machine) return undefined;
  return _machine.allowedTransitions.some((t) => t.from === from && t.to === to);
}

export function getAllowedNextStatesSelector(state: VoiceRuntimeState): VoiceRuntimeState[] | undefined {
  if (!_machine) return undefined;
  return _machine.allowedTransitions
    .filter((t) => t.from === state)
    .map((t) => t.to);
}

export function supportsPauseResume(): boolean | undefined {
  return _machine?.supportsPauseResume;
}

export function supportsInterruptionRecovery(): boolean | undefined {
  return _machine?.supportsInterruptionRecovery;
}

export function getMaxClarificationsPerTurn(): number | undefined {
  return _machine?.maxClarificationsPerTurn;
}

export function getMaxRecoveryTurns(): number | undefined {
  return _machine?.maxRecoveryTurns;
}

export function getMachineVersion(): string | undefined {
  return _machine?.version;
}
