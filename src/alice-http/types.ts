// ─────────────────────────────────────────────────────────────
// ALICE WEBHOOK / HTTP ENTRY ADAPTER v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Alice Request/Response Protocol Adapter v1.0 + Alice Bridge Adapter v1.0
//
// CORE DECISION: HTTP entry adapter = network boundary, not business logic.
// HTTP success must never masquerade as protocol success or runtime success.
// ─────────────────────────────────────────────────────────────

// -- HTTP request envelope (ingress boundary) --
export type AliceHttpRequestEnvelope = {
  method: "POST";
  headers: Record<string, string | undefined>;
  body: Record<string, unknown> | null;
  receivedAt: string;
};

// -- HTTP response envelope (egress boundary) --
export type AliceHttpResponseEnvelope = {
  statusCode: number;
  contentType: "application/json";
  body: Record<string, unknown>;
};

// -- HTTP validation result --
export type AliceHttpValidationResult = {
  valid: boolean;
  errors: string[];
  httpStatus?: number;
};

// -- HTTP entry outcome --
export type AliceHttpEntryOutcome =
  | "accepted"
  | "invalid_request"
  | "unauthorized"
  | "blocked"
  | "failed";

// -- HTTP entry adapter descriptor --
export type AliceHttpEntryAdapter = {
  adapterId: "alice_http_entry_adapter_v1";
  version: string;

  supportsPostOnly: boolean;
  supportsJsonOnly: boolean;
  supportsBoundaryValidation: boolean;
  supportsBasicVerificationGate: boolean;
  supportsProtocolHandOff: boolean;
};

// -- ValidationError --
export type AliceHttpValidationError = {
  path: string;
  message: string;
};
