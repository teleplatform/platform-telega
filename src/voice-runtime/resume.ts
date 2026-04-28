// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — Resume Logic
//
// Resume only allowed from paused state, not from terminal states.
// Path: paused → recovering | paused → listening
// Direct paused → speaking is forbidden.
// ─────────────────────────────────────────────────────────────

import type { VoiceRuntimeSession, VoiceRuntimeStateMachine, TransitionResult } from "./types.js";
import { transitionSession } from "./session.js";
import { checkResumeLegality } from "./guards.js";

export function resumeToListening(
  session: VoiceRuntimeSession,
  machine: VoiceRuntimeStateMachine,
): TransitionResult {
  if (!machine.supportsPauseResume) {
    return { ok: false, reason: "Pause/resume not supported", from: session.state, attemptedTo: "listening" };
  }

  const legality = checkResumeLegality(session);
  if (!legality.ok) {
    return { ok: false, reason: legality.reason ?? "Resume illegal", from: session.state, attemptedTo: "listening" };
  }

  return transitionSession(session, "listening", machine);
}

export function resumeToRecovering(
  session: VoiceRuntimeSession,
  machine: VoiceRuntimeStateMachine,
): TransitionResult {
  if (!machine.supportsPauseResume) {
    return { ok: false, reason: "Pause/resume not supported", from: session.state, attemptedTo: "recovering" };
  }

  const legality = checkResumeLegality(session);
  if (!legality.ok) {
    return { ok: false, reason: legality.reason ?? "Resume illegal", from: session.state, attemptedTo: "recovering" };
  }

  return transitionSession(session, "recovering", machine);
}
