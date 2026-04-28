// ─────────────────────────────────────────────────────────────
// ALICE VOICE BRIDGE ADAPTER v1.0 — Entry Helpers
//
// Required entry flow:
// AliceVoiceRequest → AliceVoiceNormalizedInput → AliceBridgeSession(opened) → runtime forwarding
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { AliceBridgeSession, AliceVoiceNormalizedInput } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function openAliceBridgeSession(input: {
  bridgeSessionId?: string;
  aliceSessionId?: string;
  userId?: string;
  languageCode?: "ru" | "en" | "uz";
  arishaEntryDetected: boolean;
}): AliceBridgeSession {
  const now = nowIso();
  return {
    bridgeSessionId: input.bridgeSessionId ?? crypto.randomUUID(),
    aliceSessionId: input.aliceSessionId,
    runtimeSessionId: undefined,
    surface: "alice",
    personaId: "arisha",
    languageCode: input.languageCode,
    active: true,
    arishaEntryDetected: input.arishaEntryDetected,
    createdAt: now,
    updatedAt: now,
  };
}

export function bindRuntimeSession(
  session: AliceBridgeSession,
  runtimeSessionId: string,
): AliceBridgeSession {
  return {
    ...session,
    runtimeSessionId,
    updatedAt: nowIso(),
    notes: [...(session.notes ?? []), `Bound to runtime session: ${runtimeSessionId}`],
  };
}

export function isSessionActive(session: AliceBridgeSession): boolean {
  return session.active;
}

export function deactivateSession(session: AliceBridgeSession): AliceBridgeSession {
  return {
    ...session,
    active: false,
    updatedAt: nowIso(),
  };
}
