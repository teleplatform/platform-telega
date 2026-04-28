// ─────────────────────────────────────────────────────────────
// VOICE TRANSPORT ORCHESTRATION CONTRACT v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Voice Runtime State Machine v1.0 + all prior layers
//
// CORE DECISION: Voice runtime must never talk directly to raw transport.
// Transport / Bridge Layer ↔ Orchestrator ↔ Voice Runtime
// ─────────────────────────────────────────────────────────────

// -- Transport surfaces --
export type VoiceTransportSurface =
  | "alice"
  | "telegram_voice"
  | "web_voice"
  | "tgm_voice"
  | "external_voice_bridge";

// -- Transport events --
export type VoiceTransportEvent =
  | "session_open_requested"
  | "session_opened"
  | "user_input_received"
  | "input_forwarded_to_runtime"
  | "runtime_ack_requested"
  | "runtime_turn_requested"
  | "system_turn_dispatched"
  | "system_turn_delivered"
  | "transport_interrupted"
  | "transport_handoff_started"
  | "transport_handoff_completed"
  | "transport_fallback_started"
  | "transport_fallback_completed"
  | "session_close_requested"
  | "session_closed"
  | "transport_failed";

// -- Transport outcomes --
export type VoiceTransportOutcome =
  | "opened"
  | "received"
  | "forwarded"
  | "acknowledged"
  | "dispatched"
  | "delivered"
  | "interrupted"
  | "transferred"
  | "fallback_delivered"
  | "closed"
  | "failed";

// -- Session binding --
export type VoiceTransportSessionBinding = {
  sessionId: string;
  surface: VoiceTransportSurface;
  transportSessionId?: string;
  bridgeId?: string;

  userId?: string;
  personaId: "arisha";
  languageCode?: "ru" | "en" | "uz";

  active: boolean;
  createdAt: string;
  updatedAt: string;

  notes?: string[];
};

// -- Orchestration contract --
export type VoiceTransportOrchestrationContract = {
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
};

// -- Transport event record --
export type VoiceTransportEventRecord = {
  id: string;
  sessionId: string;
  surface: VoiceTransportSurface;
  event: VoiceTransportEvent;
  payload?: Record<string, unknown>;
  createdAt: string;
};

// -- ValidationError --
export type VoiceTransportValidationError = {
  path: string;
  message: string;
};

// -- Orchestration result --
export type OrchestrationResult =
  | { ok: true; binding?: VoiceTransportSessionBinding; outcome?: VoiceTransportOutcome }
  | { ok: false; reason: string };
