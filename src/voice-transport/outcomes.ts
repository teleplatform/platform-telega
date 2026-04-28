// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Outcome Helpers
//
// Classifies transport outcomes truthfully:
// opened, received, forwarded, acknowledged, dispatched,
// delivered, interrupted, transferred, fallback_delivered,
// closed, failed.
//
// No generic "success" / "ok" outcomes.
// ─────────────────────────────────────────────────────────────

import type {
  VoiceTransportOutcome,
  VoiceTransportEvent,
} from "./types.js";

export function classifyOutcomeFromEvent(event: VoiceTransportEvent): VoiceTransportOutcome | null {
  switch (event) {
    case "session_opened":
      return "opened";
    case "user_input_received":
      return "received";
    case "input_forwarded_to_runtime":
      return "forwarded";
    case "runtime_ack_requested":
      return "acknowledged";
    case "system_turn_dispatched":
      return "dispatched";
    case "system_turn_delivered":
      return "delivered";
    case "transport_interrupted":
      return "interrupted";
    case "transport_handoff_completed":
      return "transferred";
    case "transport_fallback_completed":
      return "fallback_delivered";
    case "session_closed":
      return "closed";
    case "transport_failed":
      return "failed";
    default:
      return null;
  }
}

export const DELIVERABLE_OUTCOMES: VoiceTransportOutcome[] = ["delivered", "fallback_delivered"];
export const TERMINAL_OUTCOMES: VoiceTransportOutcome[] = ["closed", "failed"];
export const INTERRUPT_OUTCOMES: VoiceTransportOutcome[] = ["interrupted"];
export const TRANSFER_OUTCOMES: VoiceTransportOutcome[] = ["transferred"];

export function isDeliveredOutcome(outcome: VoiceTransportOutcome): boolean {
  return DELIVERABLE_OUTCOMES.includes(outcome);
}

export function isTerminalOutcome(outcome: VoiceTransportOutcome): boolean {
  return TERMINAL_OUTCOMES.includes(outcome);
}

export function isInterruptOutcome(outcome: VoiceTransportOutcome): boolean {
  return INTERRUPT_OUTCOMES.includes(outcome);
}

export function isTransferOutcome(outcome: VoiceTransportOutcome): boolean {
  return TRANSFER_OUTCOMES.includes(outcome);
}

export function buildDeliverySummary(
  outcome: VoiceTransportOutcome,
  surface: string,
  sessionId: string,
): Record<string, unknown> {
  return {
    sessionId,
    surface,
    outcome,
    isDelivered: isDeliveredOutcome(outcome),
    isTerminal: isTerminalOutcome(outcome),
    isInterrupted: isInterruptOutcome(outcome),
    isTransferred: isTransferOutcome(outcome),
  };
}
