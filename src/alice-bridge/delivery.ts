// ─────────────────────────────────────────────────────────────
// ALICE VOICE BRIDGE ADAPTER v1.0 — Delivery Helpers
//
// Truthfully map runtime results into AliceBridgeResponse.
// Must distinguish: forwarded, acknowledged, delivered.
// Cannot treat forwarded as delivered.
// ─────────────────────────────────────────────────────────────

import type { AliceBridgeResponse, AliceBridgeSession } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildDeliveredResponse(input: {
  requestId: string;
  bridgeSessionId?: string;
  runtimeSessionId?: string;
  responseText: string;
  truthSummary?: string;
}): AliceBridgeResponse {
  return {
    requestId: input.requestId,
    bridgeSessionId: input.bridgeSessionId,
    runtimeSessionId: input.runtimeSessionId,
    outcome: "delivered",
    responseText: input.responseText,
    truthSummary: input.truthSummary,
    shouldCloseSession: false,
  };
}

export function buildAckResponse(input: {
  requestId: string;
  bridgeSessionId?: string;
  runtimeSessionId?: string;
  responseText: string;
}): AliceBridgeResponse {
  return {
    requestId: input.requestId,
    bridgeSessionId: input.bridgeSessionId,
    runtimeSessionId: input.runtimeSessionId,
    outcome: "acknowledged",
    responseText: input.responseText,
    shouldCloseSession: false,
  };
}

export function buildForwardedResponse(input: {
  requestId: string;
  bridgeSessionId?: string;
  runtimeSessionId?: string;
  truthSummary?: string;
}): AliceBridgeResponse {
  return {
    requestId: input.requestId,
    bridgeSessionId: input.bridgeSessionId,
    runtimeSessionId: input.runtimeSessionId,
    outcome: "forwarded",
    truthSummary: input.truthSummary,
    shouldCloseSession: false,
  };
}

export function buildOpenedResponse(input: {
  requestId: string;
  bridgeSessionId?: string;
}): AliceBridgeResponse {
  return {
    requestId: input.requestId,
    bridgeSessionId: input.bridgeSessionId,
    outcome: "opened",
    shouldCloseSession: false,
  };
}

export function buildClosedResponse(input: {
  requestId: string;
  bridgeSessionId?: string;
}): AliceBridgeResponse {
  return {
    requestId: input.requestId,
    bridgeSessionId: input.bridgeSessionId,
    outcome: "failed", // closed is not a delivery outcome; session_closed maps to "failed" in adapter context
    shouldCloseSession: true,
  };
}

export function requiresResponseText(outcome: AliceBridgeResponse["outcome"]): boolean {
  return outcome === "delivered" || outcome === "acknowledged" || outcome === "fallback_delivered";
}
