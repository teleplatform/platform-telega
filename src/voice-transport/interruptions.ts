// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Transport Interruption Helpers
//
// If transport breaks/interrupts:
// Must truthfully record transport_interrupted.
// Must NOT look like normal close or completed turn.
// ─────────────────────────────────────────────────────────────

import type {
  VoiceTransportSessionBinding,
  VoiceTransportOutcome,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export type InterruptionState = {
  interrupted: boolean;
  binding: VoiceTransportSessionBinding;
  outcome: VoiceTransportOutcome;
  reason?: string;
};

export function recordTransportInterruption(
  binding: VoiceTransportSessionBinding,
  reason?: string,
): InterruptionState {
  return {
    interrupted: true,
    binding: { ...binding, updatedAt: nowIso(), notes: [...(binding.notes ?? []), `Transport interrupted: ${reason ?? "unknown"}`] },
    outcome: "interrupted",
    reason,
  };
}

export function isTransportInterruption(state: InterruptionState): boolean {
  return state.interrupted && state.outcome === "interrupted";
}

export function isInterruptedOutcome(outcome: VoiceTransportOutcome): boolean {
  return outcome === "interrupted";
}
