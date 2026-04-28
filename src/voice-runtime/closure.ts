// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — Closure Logic
//
// closing is a separate state from completed.
// Proper chain: waiting_user → closing → completed
// System must not abruptly end or mix up closure with completion.
// ─────────────────────────────────────────────────────────────

import type { VoiceRuntimeSession, VoiceRuntimeStateMachine, TransitionResult } from "./types.js";
import { transitionSession } from "./session.js";
import { checkClosureLegality } from "./guards.js";

export function startClosure(
  session: VoiceRuntimeSession,
  machine: VoiceRuntimeStateMachine,
): TransitionResult {
  const legality = checkClosureLegality(session);
  if (!legality.ok) {
    return { ok: false, reason: legality.reason ?? "Closure illegal", from: session.state, attemptedTo: "closing" };
  }

  // Mark closure pending
  const preSession: VoiceRuntimeSession = { ...session, closurePending: true };
  return transitionSession(preSession, "closing", machine);
}

export function completeSession(
  session: VoiceRuntimeSession,
  machine: VoiceRuntimeStateMachine,
): TransitionResult {
  // Can only complete from closing state
  if (session.state !== "closing") {
    return { ok: false, reason: `Can only complete from closing state, currently: ${session.state}`, from: session.state, attemptedTo: "completed" };
  }

  return transitionSession(session, "completed", machine);
}
