// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — States
//
// State metadata: meaning, terminal flags, and categories.
// ─────────────────────────────────────────────────────────────

import type { VoiceRuntimeState } from "./types.js";

export const ALL_STATES: VoiceRuntimeState[] = [
  "idle",
  "session_created",
  "listening",
  "understanding",
  "acknowledging",
  "clarifying",
  "speaking",
  "waiting_user",
  "interrupted",
  "recovering",
  "paused",
  "closing",
  "completed",
  "blocked",
  "failed",
];

export const TERMINAL_STATES: VoiceRuntimeState[] = ["completed", "blocked", "failed"];

export function isTerminalState(state: VoiceRuntimeState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function isActiveState(state: VoiceRuntimeState): boolean {
  return state !== "idle" && !isTerminalState(state);
}

export function isRecoveryState(state: VoiceRuntimeState): boolean {
  return state === "recovering" || state === "interrupted";
}

export function isListeningState(state: VoiceRuntimeState): boolean {
  return state === "listening" || state === "waiting_user";
}

export function isSpeakingState(state: VoiceRuntimeState): boolean {
  return state === "speaking" || state === "acknowledging" || state === "clarifying";
}
