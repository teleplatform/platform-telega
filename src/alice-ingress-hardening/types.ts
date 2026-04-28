// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Alice Webhook HTTP Entry Adapter v1.0 + all prior layers
//
// CORE DECISION: Security rejection must never masquerade as runtime failure.
// Ingress hardening = protective shell around HTTP boundary, not business logic.
// ─────────────────────────────────────────────────────────────

// -- Security result from hardening checks --
export type AliceIngressSecurityResult = {
  accepted: boolean;
  reason?:
    | "ok"
    | "missing_secret"
    | "invalid_secret"
    | "replay_detected"
    | "rate_limited"
    | "oversized"
    | "malformed"
    | "suspicious"
    | "internal_error";

  shouldReject: boolean;
  statusCode: 200 | 400 | 401 | 403 | 409 | 413 | 429 | 500;
  notes?: string[];
};

// -- Ingress fingerprint for replay detection --
export type AliceIngressFingerprint = {
  fingerprintId: string;
  sessionId?: string;
  userId?: string;

  requestHash: string;
  contentType?: string;
  receivedAt: string;
};

// -- Audit record for ingress trail --
export type AliceIngressAuditRecord = {
  auditId: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;

  outcome:
    | "accepted"
    | "rejected"
    | "replayed"
    | "rate_limited"
    | "failed";

  reason?: string;
  timestamp: string;
  safeMeta?: Record<string, unknown>;
};

// -- Observability event for ingress monitoring --
export type AliceIngressObservabilityEvent = {
  eventId: string;
  eventType:
    | "ingress_received"
    | "ingress_verified"
    | "ingress_rejected"
    | "ingress_replayed"
    | "ingress_rate_limited"
    | "ingress_forwarded"
    | "ingress_failed";

  timestamp: string;
  sessionId?: string;
  requestId?: string;
  safeMeta?: Record<string, unknown>;
};

// -- Hardening adapter descriptor --
export type AliceIngressHardeningAdapter = {
  adapterId: "alice_ingress_hardening_v1";
  version: string;

  supportsSharedSecretCheck: boolean;
  supportsReplayProtection: boolean;
  supportsFingerprinting: boolean;
  supportsRateLimitHooks: boolean;
  supportsAuditTrail: boolean;
  supportsObservability: boolean;
  supportsSafeLogging: boolean;
};

// -- ValidationError --
export type AliceIngressValidationError = {
  path: string;
  message: string;
};
