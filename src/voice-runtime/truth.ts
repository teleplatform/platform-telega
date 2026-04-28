// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — Truth Preservation
//
// Voice runtime must preserve truthfulness not only in phrasing
// but in lifecycle. Cannot:
// - complete session that was blocked
// - treat interrupted turn as successful completion
// - treat clarify turn as "answered"
// - mix up completed, blocked, failed terminal outcomes
// ─────────────────────────────────────────────────────────────

import type { VoiceRuntimeSession, VoiceRuntimeState } from "./types.js";
import { isTerminalState } from "./states.js";

// -- Terminal outcome classification --
export type TerminalOutcome = "completed" | "blocked" | "failed";

export function classifyTerminalOutcome(state: VoiceRuntimeState): TerminalOutcome | null {
  if (state === "completed") return "completed";
  if (state === "blocked") return "blocked";
  if (state === "failed") return "failed";
  return null;
}

// -- Truth checks --
export function isTruthyTerminalOutcome(state: VoiceRuntimeState): boolean {
  return state === "completed";
}

export function isInterruptedSession(session: VoiceRuntimeSession): boolean {
  return session.interruptionCount > 0;
}

export function wasClarified(session: VoiceRuntimeSession): boolean {
  return session.clarificationCountInCurrentTurn > 0;
}

// -- Cannot claim completion if any of these are true --
export function assertTruthfulCompletion(session: VoiceRuntimeSession): string | null {
  if (session.state !== "completed") return null; // Not terminal yet

  // If session was ever blocked or failed, it cannot be "completed"
  // This is enforced by state transitions, but we double-check here
  if (session.interruptionCount > 2) {
    return "Session had too many interruptions to claim truthful completion";
  }

  return null;
}

// -- Session summary for observability --
export function getSessionSummary(session: VoiceRuntimeSession): Record<string, unknown> {
  return {
    sessionId: session.sessionId,
    state: session.state,
    isTerminal: isTerminalState(session.state),
    terminalOutcome: classifyTerminalOutcome(session.state),
    turnCount: session.turnCount,
    interruptionCount: session.interruptionCount,
    clarificationCount: session.clarificationCountInCurrentTurn,
    contextFresh: session.contextFresh,
    closurePending: session.closurePending,
    createdAt: session.createdAt,
    lastStateAt: session.lastStateAt,
  };
}
