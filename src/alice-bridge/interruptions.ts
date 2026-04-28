// ─────────────────────────────────────────────────────────────
// ALICE VOICE BRIDGE ADAPTER v1.0 — Interruption Helpers
//
// If Alice-side transport breaks/interrupts:
// Must truthfully issue blocked/failed, NOT "delivered".
// ─────────────────────────────────────────────────────────────

import type { AliceBridgeResponse } from "./types.js";

export function buildInterruptedResponse(input: {
  requestId: string;
  bridgeSessionId?: string;
  runtimeSessionId?: string;
  reason?: string;
}): AliceBridgeResponse {
  return {
    requestId: input.requestId,
    bridgeSessionId: input.bridgeSessionId,
    runtimeSessionId: input.runtimeSessionId,
    outcome: "blocked",
    truthSummary: `Transport interrupted: ${input.reason ?? "unknown"}`,
    shouldCloseSession: true,
    notes: input.reason ? [`Interruption reason: ${input.reason}`] : undefined,
  };
}

export function buildFailedResponse(input: {
  requestId: string;
  bridgeSessionId?: string;
  runtimeSessionId?: string;
  reason?: string;
}): AliceBridgeResponse {
  return {
    requestId: input.requestId,
    bridgeSessionId: input.bridgeSessionId,
    runtimeSessionId: input.runtimeSessionId,
    outcome: "failed",
    truthSummary: `Transport failed: ${input.reason ?? "unknown"}`,
    shouldCloseSession: true,
    notes: input.reason ? [`Failure reason: ${input.reason}`] : undefined,
  };
}
