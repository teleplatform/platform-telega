// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — Interruption Handling
//
// If interruption occurs: stop current turn → interrupted state.
// Next allowed transition only to recovering or paused.
// Cannot pretend turn completed normally.
// ─────────────────────────────────────────────────────────────

import type { VoiceRuntimeSession, VoiceRuntimeStateMachine, TransitionResult } from "./types.js";
import { transitionSession } from "./session.js";

export function handleInterruption(
  session: VoiceRuntimeSession,
  machine: VoiceRuntimeStateMachine,
): TransitionResult {
  if (!machine.supportsInterruptionRecovery) {
    return { ok: false, reason: "Interruption recovery not supported", from: session.state, attemptedTo: "interrupted" };
  }

  // Can only be interrupted from speaking or acknowledging states
  if (session.state !== "speaking" && session.state !== "acknowledging") {
    return { ok: false, reason: `Cannot interrupt from state: ${session.state}`, from: session.state, attemptedTo: "interrupted" };
  }

  return transitionSession(session, "interrupted", machine);
}

export function startRecovery(
  session: VoiceRuntimeSession,
  machine: VoiceRuntimeStateMachine,
): TransitionResult {
  if (session.state !== "interrupted") {
    return { ok: false, reason: `Can only recover from interrupted state, currently: ${session.state}`, from: session.state, attemptedTo: "recovering" };
  }

  return transitionSession(session, "recovering", machine);
}
