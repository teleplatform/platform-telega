// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — Session Management
//
// Session lifecycle: create, transition, update counters.
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type {
  VoiceRuntimeSession,
  VoiceRuntimeState,
  VoiceRuntimeTransition,
  TransitionResult,
  VoiceRuntimeStateMachine,
} from "./types.js";
import { findTransition } from "./transitions.js";
import { checkTransitionGuard } from "./guards.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function createVoiceSession(input?: {
  sessionId?: string;
  languageCode?: VoiceRuntimeSession["languageCode"];
  personaId?: "arisha";
}): VoiceRuntimeSession {
  const now = nowIso();
  return {
    sessionId: input?.sessionId ?? crypto.randomUUID(),
    surface: "voice",
    state: "session_created",
    languageCode: input?.languageCode,
    personaId: input?.personaId ?? "arisha",
    turnCount: 0,
    clarificationCountInCurrentTurn: 0,
    interruptionCount: 0,
    lastStateAt: now,
    createdAt: now,
    updatedAt: now,
    contextFresh: true,
    closurePending: false,
  };
}

export function transitionSession(
  session: VoiceRuntimeSession,
  to: VoiceRuntimeState,
  machine: VoiceRuntimeStateMachine,
): TransitionResult {
  const from = session.state;
  const transition = findTransition(from, to);

  if (!transition) {
    return { ok: false, reason: `No transition defined: ${from} → ${to}`, from, attemptedTo: to };
  }

  // Guard check
  const guard = checkTransitionGuard(from, to);
  if (!guard.ok) {
    return { ok: false, reason: guard.reason ?? "Guard failed", from, attemptedTo: to };
  }

  // Apply transition
  const now = nowIso();
  const updated: VoiceRuntimeSession = {
    ...session,
    state: to,
    lastStateAt: now,
    updatedAt: now,
  };

  // Update counters based on transition
  if (to === "speaking" || to === "clarifying" || to === "acknowledging") {
    updated.lastSystemTurnAt = now;
  }
  if (to === "waiting_user") {
    updated.turnCount += 1;
    updated.clarificationCountInCurrentTurn = 0;
  }
  if (to === "interrupted") {
    updated.interruptionCount += 1;
  }
  if (to === "clarifying") {
    updated.clarificationCountInCurrentTurn += 1;
  }
  if (to === "completed" || to === "blocked" || to === "failed") {
    updated.contextFresh = false;
  }

  return { ok: true, session: updated, transition };
}
