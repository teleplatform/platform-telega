// ─────────────────────────────────────────────────────────────
// ALICE VOICE BRIDGE ADAPTER v1.0 — Truth Helpers
//
// Alice adapter must never invent runtime truth:
// - session opened ≠ conversation succeeded
// - runtime forwarded ≠ user got result
// - delivered ≠ task executed
// - fallback ≠ normal delivery
// - interrupted ≠ normal close
// ─────────────────────────────────────────────────────────────

import type { AliceBridgeResponse, AliceBridgeResponseOutcome } from "./types.js";

type AliceBridgeResponseOutcome = AliceBridgeResponse["outcome"];

export function assertAliceTransportTruth(response: AliceBridgeResponse): string | null {
  // Delivered must have response text
  if (response.outcome === "delivered" && !response.responseText) {
    return "Delivered outcome must include response text";
  }

  // Forwarded must NOT have response text (it's not delivered yet)
  if (response.outcome === "forwarded" && response.responseText) {
    return "Forwarded outcome must not include response text (not yet delivered)";
  }

  // Blocked must have shouldCloseSession = true
  if (response.outcome === "blocked" && response.shouldCloseSession !== true) {
    return "Blocked outcome should close session";
  }

  // Failed must have shouldCloseSession = true
  if (response.outcome === "failed" && response.shouldCloseSession !== true) {
    return "Failed outcome should close session";
  }

  return null;
}

export function buildTruthSummary(
  outcome: AliceBridgeResponseOutcome,
  bridgeSessionId?: string,
  runtimeSessionId?: string,
): string {
  const parts: string[] = [];

  switch (outcome) {
    case "opened":
      parts.push("Bridge session opened");
      break;
    case "forwarded":
      parts.push("Input forwarded to Arisha runtime (delivery not yet confirmed)");
      break;
    case "acknowledged":
      parts.push("Short acknowledgment sent (processing continues)");
      break;
    case "delivered":
      parts.push("Response delivered via Alice transport (delivery-level truth, not runtime execution)");
      break;
    case "transferred":
      parts.push("Session transferred to another surface");
      break;
    case "fallback_delivered":
      parts.push("Fallback delivery succeeded (not primary voice delivery)");
      break;
    case "blocked":
      parts.push("Transport blocked (session interrupted or policy stopped)");
      break;
    case "failed":
      parts.push("Transport failed (delivery could not be completed)");
      break;
  }

  if (bridgeSessionId) parts.push(`Bridge session: ${bridgeSessionId}`);
  if (runtimeSessionId) parts.push(`Runtime session: ${runtimeSessionId}`);

  return parts.join(". ");
}

export function isDeliveredDistinctFromExecuted(outcome: AliceBridgeResponseOutcome): boolean {
  return outcome === "delivered";
}

export function isOutcomeTerminal(outcome: AliceBridgeResponseOutcome): boolean {
  return outcome === "blocked" || outcome === "failed";
}
