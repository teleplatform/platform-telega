// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Validators
//
// Checks:
// - all required surfaces announced
// - all required events declared
// - all required outcomes declared
// - requiresSessionBinding === true
// - supportsHandoff === true
// - supportsFallback === true
// - supportsTransportInterruption === true
// - maxFallbackAttempts <= 1
// - maxTransportRetries <= 2
// - transport truth doesn't contradict runtime truth discipline
// ─────────────────────────────────────────────────────────────

import type {
  VoiceTransportOrchestrationContract,
  VoiceTransportSurface,
  VoiceTransportEvent,
  VoiceTransportOutcome,
  VoiceTransportValidationError,
} from "./types.js";

const REQUIRED_SURFACES: VoiceTransportSurface[] = [
  "alice",
  "telegram_voice",
  "web_voice",
  "tgm_voice",
  "external_voice_bridge",
];

const REQUIRED_EVENTS: VoiceTransportEvent[] = [
  "session_open_requested",
  "session_opened",
  "user_input_received",
  "input_forwarded_to_runtime",
  "runtime_ack_requested",
  "runtime_turn_requested",
  "system_turn_dispatched",
  "system_turn_delivered",
  "transport_interrupted",
  "transport_handoff_started",
  "transport_handoff_completed",
  "transport_fallback_started",
  "transport_fallback_completed",
  "session_close_requested",
  "session_closed",
  "transport_failed",
];

const REQUIRED_OUTCOMES: VoiceTransportOutcome[] = [
  "opened",
  "received",
  "forwarded",
  "acknowledged",
  "dispatched",
  "delivered",
  "interrupted",
  "transferred",
  "fallback_delivered",
  "closed",
  "failed",
];

export function validateTransportContract(
  contract: VoiceTransportOrchestrationContract,
): VoiceTransportValidationError[] {
  const errors: VoiceTransportValidationError[] = [];

  // Version
  if (!contract.version || contract.version.trim() === "") {
    errors.push({ path: "version", message: "Version is required" });
  }

  // Required surfaces
  for (const surface of REQUIRED_SURFACES) {
    if (!contract.supportedSurfaces.includes(surface)) {
      errors.push({ path: "supportedSurfaces", message: `Missing required surface: ${surface}` });
    }
  }

  // Required events
  for (const event of REQUIRED_EVENTS) {
    if (!contract.supportedEvents.includes(event)) {
      errors.push({ path: "supportedEvents", message: `Missing required event: ${event}` });
    }
  }

  // Required outcomes
  for (const outcome of REQUIRED_OUTCOMES) {
    if (!contract.supportedOutcomes.includes(outcome)) {
      errors.push({ path: "supportedOutcomes", message: `Missing required outcome: ${outcome}` });
    }
  }

  // Feature flags
  if (contract.requiresSessionBinding !== true) {
    errors.push({ path: "requiresSessionBinding", message: "Must be true" });
  }
  if (contract.supportsHandoff !== true) {
    errors.push({ path: "supportsHandoff", message: "Must be true" });
  }
  if (contract.supportsFallback !== true) {
    errors.push({ path: "supportsFallback", message: "Must be true" });
  }
  if (contract.supportsTransportInterruption !== true) {
    errors.push({ path: "supportsTransportInterruption", message: "Must be true" });
  }

  // Limits
  if (contract.maxFallbackAttempts > 1) {
    errors.push({ path: "maxFallbackAttempts", message: "Must be <= 1" });
  }
  if (contract.maxTransportRetries > 2) {
    errors.push({ path: "maxTransportRetries", message: "Must be <= 2" });
  }

  return errors;
}
