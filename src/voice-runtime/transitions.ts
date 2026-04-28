// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — Transitions
//
// Defines all allowed transitions and provides transition logic.
// ─────────────────────────────────────────────────────────────

import type { VoiceRuntimeState, VoiceRuntimeTransition, VoiceRuntimeTransitionReason } from "./types.js";

// -- All allowed transitions with reasons --
export const ALLOWED_TRANSITIONS: VoiceRuntimeTransition[] = [
  // Path A: standard conversation
  { from: "idle", to: "session_created", reason: "session_started" },
  { from: "session_created", to: "listening", reason: "session_started" },
  { from: "listening", to: "understanding", reason: "input_detected" },
  { from: "understanding", to: "speaking", reason: "speak_started" },
  { from: "speaking", to: "waiting_user", reason: "turn_finished" },
  { from: "waiting_user", to: "listening", reason: "input_detected" },

  // Path B: with acknowledge
  { from: "understanding", to: "acknowledging", reason: "ack_required" },
  { from: "acknowledging", to: "speaking", reason: "speak_started" },

  // Path C: with clarify
  { from: "understanding", to: "clarifying", reason: "clarification_required" },
  { from: "clarifying", to: "waiting_user", reason: "turn_finished" },

  // Path D: interruption recovery
  { from: "speaking", to: "interrupted", reason: "interrupt_detected" },
  { from: "acknowledging", to: "interrupted", reason: "interrupt_detected" },
  { from: "interrupted", to: "recovering", reason: "recovery_started" },
  { from: "recovering", to: "speaking", reason: "speak_started" },
  { from: "recovering", to: "waiting_user", reason: "turn_finished" },

  // Path E: soft closure
  { from: "waiting_user", to: "closing", reason: "closure_started" },
  { from: "closing", to: "completed", reason: "session_completed" },

  // Pause / Resume
  { from: "waiting_user", to: "paused", reason: "pause_requested" },
  { from: "speaking", to: "paused", reason: "pause_requested" },
  { from: "paused", to: "recovering", reason: "resume_requested" },
  { from: "paused", to: "listening", reason: "resume_requested" },

  // Blocked / Failed (terminal)
  { from: "listening", to: "blocked", reason: "policy_blocked" },
  { from: "understanding", to: "blocked", reason: "policy_blocked" },
  { from: "speaking", to: "blocked", reason: "policy_blocked" },
  { from: "waiting_user", to: "blocked", reason: "policy_blocked" },
  { from: "recovering", to: "blocked", reason: "policy_blocked" },
  { from: "paused", to: "blocked", reason: "policy_blocked" },

  { from: "listening", to: "failed", reason: "runtime_failed" },
  { from: "understanding", to: "failed", reason: "runtime_failed" },
  { from: "speaking", to: "failed", reason: "runtime_failed" },
  { from: "waiting_user", to: "failed", reason: "runtime_failed" },
  { from: "recovering", to: "failed", reason: "runtime_failed" },
  { from: "paused", to: "failed", reason: "runtime_failed" },

  // Recovery from stale context -> clarifying
  { from: "waiting_user", to: "clarifying", reason: "clarification_required" },
];

export function findTransition(from: VoiceRuntimeState, to: VoiceRuntimeState): VoiceRuntimeTransition | undefined {
  return ALLOWED_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function isTransitionAllowed(from: VoiceRuntimeState, to: VoiceRuntimeState): boolean {
  return findTransition(from, to) !== undefined;
}

export function getAllowedNextStates(state: VoiceRuntimeState): VoiceRuntimeState[] {
  return ALLOWED_TRANSITIONS
    .filter((t) => t.from === state)
    .map((t) => t.to);
}

export function getTransitionReason(from: VoiceRuntimeState, to: VoiceRuntimeState): VoiceRuntimeTransitionReason | undefined {
  return findTransition(from, to)?.reason;
}
