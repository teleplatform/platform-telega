// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Contract Builders
// ─────────────────────────────────────────────────────────────

import type {
  VoiceTransportOrchestrationContract,
  VoiceTransportSurface,
  VoiceTransportEvent,
  VoiceTransportOutcome,
} from "./types.js";

export function buildTransportContract(input: {
  version: string;
  supportedSurfaces: VoiceTransportSurface[];
  supportedEvents: VoiceTransportEvent[];
  supportedOutcomes: VoiceTransportOutcome[];
  requiresSessionBinding: boolean;
  supportsHandoff: boolean;
  supportsFallback: boolean;
  supportsTransportInterruption: boolean;
  maxFallbackAttempts: number;
  maxTransportRetries: number;
}): VoiceTransportOrchestrationContract {
  return {
    version: input.version,
    supportedSurfaces: input.supportedSurfaces,
    supportedEvents: input.supportedEvents,
    supportedOutcomes: input.supportedOutcomes,
    requiresSessionBinding: input.requiresSessionBinding,
    supportsHandoff: input.supportsHandoff,
    supportsFallback: input.supportsFallback,
    supportsTransportInterruption: input.supportsTransportInterruption,
    maxFallbackAttempts: input.maxFallbackAttempts,
    maxTransportRetries: input.maxTransportRetries,
  };
}

// -- Canonical event sequences --
export const ENTRY_EVENT_SEQUENCE: VoiceTransportEvent[] = [
  "session_open_requested",
  "session_opened",
  "user_input_received",
  "input_forwarded_to_runtime",
];

export const ACK_EVENT_SEQUENCE: VoiceTransportEvent[] = [
  "runtime_ack_requested",
  "system_turn_dispatched",
  "system_turn_delivered",
];

export const MAIN_TURN_SEQUENCE: VoiceTransportEvent[] = [
  "runtime_turn_requested",
  "system_turn_dispatched",
  "system_turn_delivered",
];

export const HANDOFF_SEQUENCE: VoiceTransportEvent[] = [
  "transport_handoff_started",
  "transport_handoff_completed",
];

export const FALLBACK_SEQUENCE: VoiceTransportEvent[] = [
  "transport_fallback_started",
  "transport_fallback_completed",
];

export const CLOSE_SEQUENCE: VoiceTransportEvent[] = [
  "session_close_requested",
  "session_closed",
];
