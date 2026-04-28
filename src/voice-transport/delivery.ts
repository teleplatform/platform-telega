// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Delivery Helpers
//
// Truthfully dispatch system turns:
// runtime_turn_requested → system_turn_dispatched → system_turn_delivered
// Must not confuse dispatched with delivered.
// ─────────────────────────────────────────────────────────────

import type {
  VoiceTransportSessionBinding,
  VoiceTransportEvent,
  VoiceTransportOutcome,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export type DeliveryState = {
  binding: VoiceTransportSessionBinding;
  dispatched: boolean;
  delivered: boolean;
  lastEvent?: VoiceTransportEvent;
  lastOutcome?: VoiceTransportOutcome;
};

export function dispatchTurn(binding: VoiceTransportSessionBinding): DeliveryState {
  return {
    binding: { ...binding, updatedAt: nowIso() },
    dispatched: true,
    delivered: false,
    lastEvent: "system_turn_dispatched",
    lastOutcome: "dispatched",
  };
}

export function confirmDelivery(state: DeliveryState): DeliveryState {
  if (!state.dispatched) {
    // Cannot confirm delivery without dispatch
    return state;
  }
  return {
    ...state,
    binding: { ...state.binding, updatedAt: nowIso() },
    delivered: true,
    lastEvent: "system_turn_delivered",
    lastOutcome: "delivered",
  };
}

export function isDelivered(state: DeliveryState): boolean {
  return state.delivered && state.dispatched;
}

export function isDispatched(state: DeliveryState): boolean {
  return state.dispatched;
}

export function requireDispatchBeforeDelivery(dispatched: boolean): boolean {
  return dispatched;
}
