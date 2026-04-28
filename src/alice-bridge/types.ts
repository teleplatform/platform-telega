// ─────────────────────────────────────────────────────────────
// ALICE VOICE BRIDGE ADAPTER v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Voice Transport Orchestration Contract v1.0 + all prior layers
//
// CORE DECISION: Alice adapter = transport adapter, not brain.
// Alice adapter normalizes ingress, binds sessions, forwards to runtime,
// and truthfully returns transport-level outcomes.
// ─────────────────────────────────────────────────────────────

// -- Alice voice request (adapter-safe ingress contract) --
export type AliceVoiceRequest = {
  requestId: string;
  aliceSessionId?: string;
  userId?: string;

  inputText?: string;
  locale?: string;

  rawPayload?: Record<string, unknown>;
  timestamp?: string;
};

// -- Normalized input after adapter processing --
export type AliceVoiceNormalizedInput = {
  requestId: string;
  sourceSurface: "alice";
  sessionId?: string;
  userId?: string;

  text: string;
  languageCode: "ru" | "en" | "uz";
  entryIntent: "arisha_entry" | "plain_voice_turn" | "unknown";

  personaId: "arisha";
  valid: boolean;
  validationErrors?: string[];
};

// -- Bridge session (adapter-side session tracking) --
export type AliceBridgeSession = {
  bridgeSessionId: string;
  aliceSessionId?: string;
  runtimeSessionId?: string;

  surface: "alice";
  personaId: "arisha";
  languageCode?: "ru" | "en" | "uz";

  active: boolean;
  arishaEntryDetected: boolean;

  createdAt: string;
  updatedAt: string;
};

// -- Bridge response (adapter-side egress contract) --
export type AliceBridgeResponse = {
  requestId: string;
  bridgeSessionId?: string;
  runtimeSessionId?: string;

  outcome:
    | "opened"
    | "forwarded"
    | "acknowledged"
    | "delivered"
    | "transferred"
    | "fallback_delivered"
    | "blocked"
    | "failed";

  responseText?: string;
  truthSummary?: string;
  shouldCloseSession?: boolean;

  notes?: string[];
};

// -- Bridge adapter descriptor --
export type AliceVoiceBridgeAdapter = {
  adapterId: "alice_voice_bridge_v1";
  version: string;

  supportsArishaEntryDetection: boolean;
  supportsSessionBinding: boolean;
  supportsTransportTruth: boolean;
  supportsFallbackToTextSurface: boolean;
};

// -- ValidationError --
export type AliceBridgeValidationError = {
  path: string;
  message: string;
};

// -- Entry patterns --
export type EntryPattern = {
  pattern: string;
  languageCode: "ru" | "en" | "uz";
  intent: "arisha_entry";
};
