// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Entry Helpers
//
// Required entry spine:
// session_open_requested → session_opened → user_input_received → input_forwarded_to_runtime
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type {
  VoiceTransportSessionBinding,
  VoiceTransportSurface,
  VoiceTransportEvent,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function createSessionBinding(input: {
  sessionId?: string;
  surface: VoiceTransportSurface;
  transportSessionId?: string;
  bridgeId?: string;
  userId?: string;
  languageCode?: "ru" | "en" | "uz";
}): VoiceTransportSessionBinding {
  const now = nowIso();
  return {
    sessionId: input.sessionId ?? crypto.randomUUID(),
    surface: input.surface,
    transportSessionId: input.transportSessionId,
    bridgeId: input.bridgeId,
    userId: input.userId,
    personaId: "arisha",
    languageCode: input.languageCode,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function recordEntryEvent(
  binding: VoiceTransportSessionBinding,
  event: VoiceTransportEvent,
): VoiceTransportSessionBinding {
  return {
    ...binding,
    updatedAt: nowIso(),
  };
}

export function validateEntrySequence(events: VoiceTransportEvent[]): boolean {
  // Check that the required entry spine is present in order
  const requiredSpine = ["session_open_requested", "session_opened", "user_input_received", "input_forwarded_to_runtime"];
  let spineIndex = 0;
  for (const event of events) {
    if (event === requiredSpine[spineIndex]) {
      spineIndex++;
    }
  }
  return spineIndex === requiredSpine.length;
}

export function isActiveBinding(binding: VoiceTransportSessionBinding): boolean {
  return binding.active;
}

export function deactivateBinding(binding: VoiceTransportSessionBinding): VoiceTransportSessionBinding {
  return {
    ...binding,
    active: false,
    updatedAt: nowIso(),
  };
}
