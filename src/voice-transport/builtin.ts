// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Builtin Contract
//
// Production-grade transport orchestration between voice runtime
// and external voice surfaces: alice, telegram_voice, web_voice,
// tgm_voice, external_voice_bridge.
// ─────────────────────────────────────────────────────────────

import type { VoiceTransportOrchestrationContract } from "./types.js";
import { buildTransportContract } from "./contracts.js";
import { setVoiceTransportContract } from "./selectors.js";

export const voiceTransportContract: VoiceTransportOrchestrationContract = buildTransportContract({
  version: "1.0.0",
  supportedSurfaces: [
    "alice",
    "telegram_voice",
    "web_voice",
    "tgm_voice",
    "external_voice_bridge",
  ],
  supportedEvents: [
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
  ],
  supportedOutcomes: [
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
  ],
  requiresSessionBinding: true,
  supportsHandoff: true,
  supportsFallback: true,
  supportsTransportInterruption: true,
  maxFallbackAttempts: 1,
  maxTransportRetries: 2,
});

// Auto-register
setVoiceTransportContract(voiceTransportContract);
