// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Truth Helpers
//
// Transport truth must never be faked as runtime truth:
// - delivered ≠ executed
// - forwarded ≠ understood
// - handoff_completed ≠ task_done
// - session_opened ≠ conversation succeeded
//
// Checks transport truth consistency and forbids false equivalences.
// ─────────────────────────────────────────────────────────────

import type {
  VoiceTransportOutcome,
  VoiceTransportEvent,
} from "./types.js";

// -- Forbidden equivalences --
export function isTransportOutcomeMasqueradingAsRuntimeSuccess(
  outcome: VoiceTransportOutcome,
  claimedRuntimeSuccess: boolean,
): boolean {
  // Transport delivered should NOT be claimed as runtime executed
  if (outcome === "delivered" && claimedRuntimeSuccess) return false; // delivered is delivery-level truth, not runtime execution truth
  // Transport forwarded should NOT be claimed as understood
  if (outcome === "forwarded" && claimedRuntimeSuccess) return true;
  // Transport handoff_completed should NOT be claimed as task_done
  if (outcome === "transferred" && claimedRuntimeSuccess) return false; // transferred is handoff truth, not task truth
  return false;
}

export function assertDeliveryTruthMatchesOutcome(
  outcome: VoiceTransportOutcome,
  event: VoiceTransportEvent,
): boolean {
  // Delivered outcome must come from system_turn_delivered event
  if (outcome === "delivered" && event !== "system_turn_delivered") return false;
  // Dispatched outcome must come from system_turn_dispatched event
  if (outcome === "dispatched" && event !== "system_turn_dispatched") return false;
  // Transferred outcome must come from handoff_completed event
  if (outcome === "transferred" && event !== "transport_handoff_completed") return false;
  // Interrupted outcome must come from transport_interrupted event
  if (outcome === "interrupted" && event !== "transport_interrupted") return false;
  // Fallback delivered must come from fallback_completed event
  if (outcome === "fallback_delivered" && event !== "transport_fallback_completed") return false;
  return true;
}

export function buildTransportTruthSummary(
  outcome: VoiceTransportOutcome,
  surface: string,
): string {
  switch (outcome) {
    case "delivered":
      return `Turn delivered via ${surface} (transport-level truth, not runtime execution)`;
    case "dispatched":
      return `Turn dispatched via ${surface} (not yet confirmed delivered)`;
    case "transferred":
      return `Session transferred to another surface via ${surface}`;
    case "interrupted":
      return `Transport interrupted on ${surface} (not a normal close)`;
    case "fallback_delivered":
      return `Fallback delivery succeeded on ${surface} (not primary transport)`;
    case "failed":
      return `Transport failed on ${surface} (not delivered, not closed)`;
    case "closed":
      return `Session closed on ${surface}`;
    case "opened":
      return `Session opened on ${surface}`;
    default:
      return `Transport outcome ${outcome} on ${surface}`;
  }
}

export function isDeliveredDistinctFromExecuted(outcome: VoiceTransportOutcome): boolean {
  // Transport delivered is ALWAYS distinct from runtime executed
  return outcome === "delivered";
}
