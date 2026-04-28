// ─────────────────────────────────────────────────────────────
// ALICE VOICE BRIDGE ADAPTER v1.0 — Fallback Helpers
//
// In v1, only bounded fallback is allowed:
// alice → web_voice, telegram_voice, tgm_voice, or text-safe response.
// Must NOT masquerade fallback as normal delivery.
// ─────────────────────────────────────────────────────────────

import type { AliceBridgeResponse, AliceBridgeSession } from "./types.js";

const ALLOWED_FALLBACK_SURFACES = ["web_voice", "telegram_voice", "tgm_voice", "text"] as const;
type FallbackSurface = typeof ALLOWED_FALLBACK_SURFACES[number];

export type FallbackTarget = {
  surface: FallbackSurface;
  reason: string;
};

export function canFallbackFromAlice(target: FallbackTarget): boolean {
  return ALLOWED_FALLBACK_SURFACES.includes(target.surface);
}

export function buildFallbackResponse(input: {
  requestId: string;
  bridgeSessionId?: string;
  runtimeSessionId?: string;
  fallbackTarget?: FallbackTarget;
  responseText?: string;
  truthSummary?: string;
}): AliceBridgeResponse {
  const notes: string[] = [];
  if (input.fallbackTarget) {
    notes.push(`Fallback to ${input.fallbackTarget.surface}: ${input.fallbackTarget.reason}`);
  }

  return {
    requestId: input.requestId,
    bridgeSessionId: input.bridgeSessionId,
    runtimeSessionId: input.runtimeSessionId,
    outcome: "fallback_delivered",
    responseText: input.responseText,
    truthSummary: input.truthSummary ?? "Fallback delivery (not primary voice delivery)",
    shouldCloseSession: false,
    notes,
  };
}
