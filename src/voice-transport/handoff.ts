// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Handoff Helpers
//
// Handoff is first-class orchestration behavior:
// transport_handoff_started → transport_handoff_completed
// Outcome = transferred, not delivered.
// Session ownership changes to new surface.
// ─────────────────────────────────────────────────────────────

import type {
  VoiceTransportSessionBinding,
  VoiceTransportSurface,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export type HandoffState = {
  started: boolean;
  completed: boolean;
  fromSurface: VoiceTransportSurface;
  toSurface: VoiceTransportSurface;
  binding: VoiceTransportSessionBinding;
};

export function startHandoff(
  binding: VoiceTransportSessionBinding,
  toSurface: VoiceTransportSurface,
): HandoffState {
  if (binding.surface === toSurface) {
    throw new Error("Cannot handoff to the same surface");
  }
  return {
    started: true,
    completed: false,
    fromSurface: binding.surface,
    toSurface,
    binding: { ...binding, updatedAt: nowIso(), notes: [...(binding.notes ?? []), `Handoff started to ${toSurface}`] },
  };
}

export function completeHandoff(state: HandoffState): HandoffState {
  if (!state.started) {
    throw new Error("Cannot complete handoff without starting it");
  }
  return {
    ...state,
    completed: true,
    binding: {
      ...state.binding,
      surface: state.toSurface,
      updatedAt: nowIso(),
      notes: [...(state.binding.notes ?? []), `Handoff completed from ${state.fromSurface} to ${state.toSurface}`],
    },
  };
}

export function isHandoffComplete(state: HandoffState): boolean {
  return state.started && state.completed;
}

export function getHandoffOutcome(state: HandoffState): "transferred" | null {
  return state.completed ? "transferred" : null;
}
