// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Closure Logic
//
// Decides whether to end Alice protocol session.
// end_session depends on:
// - outcome (blocked/failed → true)
// - explicit close flag from bridge
// - not on response length or convenience
// ─────────────────────────────────────────────────────────────

import type { AliceBridgeResponse } from "../alice-bridge/types.js";

export function shouldEndAliceSession(
  outcome: AliceBridgeResponse["outcome"],
  explicitCloseFlag?: boolean,
): boolean {
  // Terminal outcomes always end session
  if (outcome === "blocked" || outcome === "failed") return true;

  // Explicit close flag from bridge layer
  if (explicitCloseFlag === true) return true;

  // Non-terminal outcomes keep session open
  // opened, forwarded, acknowledged, delivered, transferred → false
  // fallback_delivered → false (can continue on fallback surface)
  return false;
}

export function isOutcomeTerminal(outcome: AliceBridgeResponse["outcome"]): boolean {
  return outcome === "blocked" || outcome === "failed";
}

export function canContinueSession(outcome: AliceBridgeResponse["outcome"]): boolean {
  return !isOutcomeTerminal(outcome);
}
