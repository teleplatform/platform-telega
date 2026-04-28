// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Alice Voice Bridge Adapter v1.0 + all prior layers
//
// CORE DECISION: Protocol adapter = vendor boundary, not business logic.
// Alice protocol success must never masquerade as runtime success.
// ─────────────────────────────────────────────────────────────

// -- Alice protocol request envelope (vendor-shaped but not SDK-deep) --
export type AliceProtocolRequest = {
  meta?: {
    locale?: string;
    timezone?: string;
    client_id?: string;
  };
  session: {
    session_id: string;
    user_id?: string;
    new?: boolean;
  };
  request: {
    command?: string;
    original_utterance?: string;
    type?: string;
  };
  version?: string;
  rawPayload?: Record<string, unknown>;
};

// -- Alice protocol response envelope --
export type AliceProtocolResponse = {
  response: {
    text: string;
    end_session: boolean;
  };
  session: {
    session_id: string;
    user_id?: string;
    new?: boolean;
  };
  version: string;
};

// -- Session meta extracted from protocol request --
export type AliceProtocolSessionMeta = {
  sessionId: string;
  userId?: string;
  isNew: boolean;
  locale?: string;
  timezone?: string;
  protocolVersion: string;
};

// -- Normalized protocol request (ready for bridge adapter) --
export type AliceProtocolNormalizedRequest = {
  protocolRequestId: string;
  session: AliceProtocolSessionMeta;

  text: string;
  languageCode: "ru" | "en" | "uz";
  valid: boolean;
  validationErrors?: string[];

  entryIntent: "arisha_entry" | "plain_voice_turn" | "unknown";
};

// -- Protocol adapter descriptor --
export type AliceProtocolAdapter = {
  adapterId: "alice_protocol_adapter_v1";
  version: string;

  supportsProtocolValidation: boolean;
  supportsRequestNormalization: boolean;
  supportsResponseMapping: boolean;
  supportsTruthfulEndSession: boolean;
};

// -- ValidationError --
export type AliceProtocolValidationError = {
  path: string;
  message: string;
};

// -- Entry patterns (re-exported from alice-bridge concept) --
export type EntryPattern = {
  pattern: string;
  languageCode: "ru" | "en" | "uz";
  intent: "arisha_entry";
};
