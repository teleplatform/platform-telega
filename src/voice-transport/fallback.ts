// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Fallback Helpers
//
// Fallback is first-class:
// transport_fallback_started → transport_fallback_completed
// Outcome = fallback_delivered or failed, NOT regular delivered.
// Respects maxFallbackAttempts = 1 and maxTransportRetries = 2.
// ─────────────────────────────────────────────────────────────

import type {
  VoiceTransportSessionBinding,
  VoiceTransportOutcome,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export type FallbackState = {
  started: boolean;
  completed: boolean;
  attemptCount: number;
  binding: VoiceTransportSessionBinding;
  outcome: VoiceTransportOutcome;
  maxAttempts: number;
};

export function startFallback(
  binding: VoiceTransportSessionBinding,
  maxAttempts: number = 1,
): FallbackState {
  return {
    started: true,
    completed: false,
    attemptCount: 1,
    binding: { ...binding, updatedAt: nowIso(), notes: [...(binding.notes ?? []), "Fallback started"] },
    outcome: "failed",
    maxAttempts,
  };
}

export function completeFallback(state: FallbackState, success: boolean): FallbackState {
  if (!state.started) {
    throw new Error("Cannot complete fallback without starting it");
  }
  if (state.attemptCount >= state.maxAttempts && !success) {
    // Exceeded attempts
    return {
      ...state,
      completed: true,
      outcome: "failed",
      binding: { ...state.binding, updatedAt: nowIso(), notes: [...(state.binding.notes ?? []), "Fallback failed — attempts exhausted"] },
    };
  }
  return {
    ...state,
    completed: true,
    attemptCount: success ? state.attemptCount : state.attemptCount + 1,
    outcome: success ? "fallback_delivered" : "failed",
    binding: { ...state.binding, updatedAt: nowIso(), notes: [...(state.binding.notes ?? []), success ? "Fallback completed" : "Fallback failed"] },
  };
}

export function isFallbackDelivered(state: FallbackState): boolean {
  return state.completed && state.outcome === "fallback_delivered";
}

export function canRetryFallback(state: FallbackState): boolean {
  return state.attemptCount < state.maxAttempts && !state.completed;
}
