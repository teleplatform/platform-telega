// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Main Hardening Handler
//
// runAliceIngressHardening() does ONLY:
// 1. build fingerprint
// 2. run secret validation
// 3. run oversize/malformed guards
// 4. run replay check
// 5. run rate limit check
// 6. emit audit + observability
// 7. return AliceIngressSecurityResult
// 8. never call runtime directly
//
// Must run BEFORE protocol handoff.
// ─────────────────────────────────────────────────────────────

import type {
  AliceIngressSecurityResult,
  AliceIngressFingerprint,
  AliceIngressAuditRecord,
  AliceIngressObservabilityEvent,
} from "./types.js";
import { buildIngressFingerprint } from "./fingerprint.js";
import { validateIngressSecret } from "./secrets.js";
import { isReplayRequest, rememberIngressFingerprint } from "./replay.js";
import { checkIngressRateLimit } from "./rate-limit.js";
import { checkOversizedRequest, checkMalformedIngress, checkSuspiciousPatterns } from "./guards.js";
import { buildIngressAuditRecord, recordIngressAudit } from "./audit.js";
import { buildIngressObservabilityEvent, emitIngressObservabilityEvent } from "./observability.js";

export type HardeningInput = {
  headers: Record<string, string | undefined>;
  body: unknown;
  sessionId?: string;
  userId?: string;
  contentType?: string;
};

export function runAliceIngressHardening(input: HardeningInput): AliceIngressSecurityResult {
  try {
    // 1. Build fingerprint
    const fingerprint = buildIngressFingerprint({
      sessionId: input.sessionId,
      userId: input.userId,
      body: input.body,
      contentType: input.contentType,
    });

    // 2. Run secret validation
    const secretResult = validateIngressSecret(input.headers);
    if (!secretResult.valid) {
      const reason = secretResult.reason === "missing_secret" ? "missing_secret" : "invalid_secret";
      const statusCode = secretResult.reason === "missing_secret" ? 401 : 403;

      emitAuditAndObservability({
        sessionId: input.sessionId,
        outcome: "rejected",
        reason,
        safeMeta: { fingerprintId: fingerprint.fingerprintId },
      });

      return {
        accepted: false,
        reason,
        shouldReject: true,
        statusCode: statusCode as 401 | 403,
      };
    }

    // 3. Run oversize/malformed guards
    if (checkOversizedRequest(input.body)) {
      emitAuditAndObservability({
        sessionId: input.sessionId,
        outcome: "rejected",
        reason: "oversized",
        safeMeta: { fingerprintId: fingerprint.fingerprintId },
      });

      return {
        accepted: false,
        reason: "oversized",
        shouldReject: true,
        statusCode: 413,
      };
    }

    const malformedCheck = checkMalformedIngress(input.body);
    if (malformedCheck.malformed) {
      emitAuditAndObservability({
        sessionId: input.sessionId,
        outcome: "rejected",
        reason: "malformed",
        safeMeta: { fingerprintId: fingerprint.fingerprintId, malformedReason: malformedCheck.reason },
      });

      return {
        accepted: false,
        reason: "malformed",
        shouldReject: true,
        statusCode: 400,
      };
    }

    // Check suspicious patterns (non-blocking but logged)
    const suspiciousCheck = checkSuspiciousPatterns(input.body);
    if (suspiciousCheck.suspicious) {
      emitAuditAndObservability({
        sessionId: input.sessionId,
        outcome: "rejected",
        reason: "suspicious",
        safeMeta: { fingerprintId: fingerprint.fingerprintId, suspiciousReason: suspiciousCheck.reason },
      });

      return {
        accepted: false,
        reason: "suspicious",
        shouldReject: true,
        statusCode: 400,
      };
    }

    // 4. Run replay check
    if (isReplayRequest(fingerprint)) {
      emitAuditAndObservability({
        sessionId: input.sessionId,
        outcome: "replayed",
        reason: "replay_detected",
        safeMeta: { fingerprintId: fingerprint.fingerprintId },
      });

      return {
        accepted: false,
        reason: "replay_detected",
        shouldReject: true,
        statusCode: 409,
      };
    }

    // 5. Run rate limit check
    const rateLimitKey = input.sessionId ?? input.userId ?? fingerprint.requestHash;
    const rateResult = checkIngressRateLimit(rateLimitKey);
    if (!rateResult.allowed) {
      emitAuditAndObservability({
        sessionId: input.sessionId,
        outcome: "rate_limited",
        reason: "rate_limited",
        safeMeta: { fingerprintId: fingerprint.fingerprintId },
      });

      return {
        accepted: false,
        reason: "rate_limited",
        shouldReject: true,
        statusCode: 429,
      };
    }

    // Remember this fingerprint to detect future replays
    rememberIngressFingerprint(fingerprint);

    // 6. Emit accepted audit + observability
    emitAuditAndObservability({
      sessionId: input.sessionId,
      outcome: "accepted",
      reason: "ok",
      safeMeta: { fingerprintId: fingerprint.fingerprintId },
    });

    // 7. Return security result — accepted
    return {
      accepted: true,
      reason: "ok",
      shouldReject: false,
      statusCode: 200,
    };
  } catch (err) {
    // 8. Never leak internals — safe internal error
    emitAuditAndObservability({
      sessionId: input.sessionId,
      outcome: "failed",
      reason: "internal_error",
      safeMeta: {},
    });

    return {
      accepted: false,
      reason: "internal_error",
      shouldReject: true,
      statusCode: 500,
    };
  }
}

function emitAuditAndObservability(input: {
  sessionId?: string;
  outcome: AliceIngressAuditRecord["outcome"];
  reason?: string;
  safeMeta?: Record<string, unknown>;
}): void {
  // Build and record audit record
  const auditRecord = buildIngressAuditRecord({
    sessionId: input.sessionId,
    outcome: input.outcome,
    reason: input.reason,
    safeMeta: input.safeMeta,
  });
  recordIngressAudit(auditRecord);

  // Map audit outcome to observability event type
  const eventTypeMap: Record<string, AliceIngressObservabilityEvent["eventType"]> = {
    accepted: "ingress_verified",
    rejected: "ingress_rejected",
    replayed: "ingress_replayed",
    rate_limited: "ingress_rate_limited",
    failed: "ingress_failed",
  };

  const eventType = eventTypeMap[input.outcome] ?? "ingress_failed";

  // Build and emit observability event
  const obsEvent = buildIngressObservabilityEvent({
    eventType,
    sessionId: input.sessionId,
    requestId: input.safeMeta?.fingerprintId as string | undefined,
    safeMeta: input.safeMeta,
  });
  emitIngressObservabilityEvent(obsEvent);
}
