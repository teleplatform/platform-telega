// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — Guard Layer
//
// Checks transition validity, clarify limit, recovery limit,
// resume legality, closure legality, and terminal state guards.
// ─────────────────────────────────────────────────────────────

import type { VoiceRuntimeSession, VoiceRuntimeState, VoiceRuntimeStateMachine } from "./types.js";
import { isTransitionAllowed } from "./transitions.js";
import { isTerminalState } from "./states.js";

export type GuardCheckResult = {
  ok: boolean;
  reason?: string;
};

export function checkTransitionGuard(
  from: VoiceRuntimeState,
  to: VoiceRuntimeState,
): GuardCheckResult {
  if (!isTransitionAllowed(from, to)) {
    return { ok: false, reason: `Transition ${from} → ${to} is not allowed` };
  }
  return { ok: true };
}

export function checkClarifyLimit(
  session: VoiceRuntimeSession,
  machine: VoiceRuntimeStateMachine,
): GuardCheckResult {
  if (session.clarificationCountInCurrentTurn >= machine.maxClarificationsPerTurn) {
    return { ok: false, reason: `Clarify limit reached (${session.clarificationCountInCurrentTurn}/${machine.maxClarificationsPerTurn})` };
  }
  return { ok: true };
}

export function checkRecoveryLimit(
  session: VoiceRuntimeSession,
  machine: VoiceRuntimeStateMachine,
): GuardCheckResult {
  if (session.interruptionCount > machine.maxRecoveryTurns) {
    return { ok: false, reason: `Recovery limit reached (${session.interruptionCount}/${machine.maxRecoveryTurns})` };
  }
  return { ok: true };
}

export function checkResumeLegality(
  session: VoiceRuntimeSession,
): GuardCheckResult {
  if (session.state !== "paused") {
    return { ok: false, reason: `Cannot resume from state: ${session.state}` };
  }
  if (isTerminalState(session.state)) {
    return { ok: false, reason: `Cannot resume from terminal state: ${session.state}` };
  }
  return { ok: true };
}

export function checkClosureLegality(
  session: VoiceRuntimeSession,
): GuardCheckResult {
  if (isTerminalState(session.state)) {
    return { ok: false, reason: `Cannot close from terminal state: ${session.state}` };
  }
  if (session.state === "idle") {
    return { ok: false, reason: "Cannot close from idle" };
  }
  if (session.state === "session_created") {
    return { ok: false, reason: "Cannot close from session_created — must start conversation first" };
  }
  return { ok: true };
}

export function checkCanContinue(
  session: VoiceRuntimeSession,
): GuardCheckResult {
  if (isTerminalState(session.state)) {
    return { ok: false, reason: `Cannot continue from terminal state: ${session.state}` };
  }
  if (session.state === "idle") {
    return { ok: false, reason: "Cannot continue from idle" };
  }
  if (!session.contextFresh) {
    return { ok: false, reason: "Context not fresh — cannot continue without recovery" };
  }
  return { ok: true };
}

export function canTransitionToSpeaking(
  session: VoiceRuntimeSession,
): GuardCheckResult {
  // Speaking can only be reached from: understanding, acknowledging, recovering
  const allowedFrom: VoiceRuntimeState[] = ["understanding", "acknowledging", "recovering"];
  if (!allowedFrom.includes(session.state)) {
    return { ok: false, reason: `Cannot transition to speaking from: ${session.state}` };
  }
  return { ok: true };
}
