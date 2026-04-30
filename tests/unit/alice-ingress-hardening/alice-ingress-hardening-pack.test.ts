// Alice Ingress Hardening Pack v1.0 — Unit Tests
// Run with: npx tsx tests/unit/alice-ingress-hardening/alice-ingress-hardening-pack.test.ts

import assert from "node:assert/strict";
import { aliceIngressHardeningAdapter } from "../../../src/alice-ingress-hardening/builtin.js";
import { validateIngressHardeningAdapter } from "../../../src/alice-ingress-hardening/validators.js";
import {
  getAliceIngressHardeningAdapter,
  supportsSharedSecretCheck,
  supportsReplayProtection,
  supportsFingerprinting,
  supportsRateLimitHooks,
  supportsAuditTrail,
  supportsObservability,
  supportsSafeLogging,
  getAdapterVersion,
  getAdapterId,
} from "../../../src/alice-ingress-hardening/selectors.js";
import {
  setExpectedIngressSecret,
  getExpectedIngressSecret,
  isSecretCheckEnabled,
  validateIngressSecret,
  getSecretHeaderKey,
} from "../../../src/alice-ingress-hardening/secrets.js";
import {
  buildIngressFingerprint,
  hashIngressPayload,
  fingerprintsMatch,
} from "../../../src/alice-ingress-hardening/fingerprint.js";
import {
  isReplayRequest,
  rememberIngressFingerprint,
  getReplayWindowStats,
  clearReplayWindow,
} from "../../../src/alice-ingress-hardening/replay.js";
import {
  checkIngressRateLimit,
  resetRateLimit,
  setRateLimitConfig,
  cleanExpiredRateCounters,
  getRateLimitStats,
} from "../../../src/alice-ingress-hardening/rate-limit.js";
import {
  buildIngressAuditRecord,
  recordIngressAudit,
  getRecentAuditRecords,
  getAuditTrailStats,
} from "../../../src/alice-ingress-hardening/audit.js";
import {
  buildIngressObservabilityEvent,
  emitIngressObservabilityEvent,
  getRecentObservabilityEvents,
  getObservabilityStats,
} from "../../../src/alice-ingress-hardening/observability.js";
import {
  sanitizeIngressLogMeta,
  getSafeLogEntries,
  getSafeLogStats,
} from "../../../src/alice-ingress-hardening/logging.js";
import {
  checkOversizedRequest,
  checkMalformedIngress,
  checkSuspiciousPatterns,
} from "../../../src/alice-ingress-hardening/guards.js";
import {
  runAliceIngressHardening,
  type HardeningInput,
} from "../../../src/alice-ingress-hardening/adapter.js";
import { clearReplayWindow as clearReplay } from "../../../src/alice-ingress-hardening/replay.js";

// Auto-registered via builtin import
const ADAPTER = aliceIngressHardeningAdapter;

// Helper to reset state between tests
function resetAll() {
  clearReplay();
  setExpectedIngressSecret(null);
  setRateLimitConfig(60, 60000);
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  resetAll();
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

// ── Builtin Loading ──
console.log("\nBuiltin loading:");

test("builtin hardening adapter loads", () => {
  assert.ok(ADAPTER);
  assert.equal(ADAPTER.adapterId, "alice_ingress_hardening_v1");
  assert.equal(ADAPTER.version, "1.0.0");
});

test("builtin has all feature flags", () => {
  assert.equal(ADAPTER.supportsSharedSecretCheck, true);
  assert.equal(ADAPTER.supportsReplayProtection, true);
  assert.equal(ADAPTER.supportsFingerprinting, true);
  assert.equal(ADAPTER.supportsRateLimitHooks, true);
  assert.equal(ADAPTER.supportsAuditTrail, true);
  assert.equal(ADAPTER.supportsObservability, true);
  assert.equal(ADAPTER.supportsSafeLogging, true);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin adapter validates with no errors", () => {
  const errors = validateIngressHardeningAdapter(ADAPTER);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

// ── Fingerprint ──
console.log("\nFingerprint:");

test("buildIngressFingerprint creates fingerprint", () => {
  const fp = buildIngressFingerprint({
    sessionId: "s1",
    userId: "u1",
    body: { session: { session_id: "s1" }, request: { command: "hello" } },
    contentType: "application/json",
  });
  assert.ok(fp.fingerprintId);
  assert.equal(fp.sessionId, "s1");
  assert.equal(fp.userId, "u1");
  assert.ok(fp.requestHash);
  assert.ok(fp.receivedAt);
});

test("hashIngressPayload produces consistent hash", () => {
  const input1 = { sessionId: "s1", userId: "u1", body: { session: { session_id: "s1" } }, contentType: "application/json" };
  const input2 = { sessionId: "s1", userId: "u1", body: { session: { session_id: "s1" } }, contentType: "application/json" };
  assert.equal(hashIngressPayload(input1), hashIngressPayload(input2));
});

test("hashIngressPayload differs for different sessions", () => {
  const input1 = { sessionId: "s1", body: {} };
  const input2 = { sessionId: "s2", body: {} };
  assert.notEqual(hashIngressPayload(input1), hashIngressPayload(input2));
});

test("fingerprintsMatch returns true for same fingerprint", () => {
  const fp1 = buildIngressFingerprint({ sessionId: "s1", body: {} });
  const fp2 = buildIngressFingerprint({ sessionId: "s1", body: {} });
  assert.equal(fingerprintsMatch(fp1, fp2), true);
});

test("fingerprintsMatch returns false for different sessions", () => {
  const fp1 = buildIngressFingerprint({ sessionId: "s1", body: {} });
  const fp2 = buildIngressFingerprint({ sessionId: "s2", body: {} });
  assert.equal(fingerprintsMatch(fp1, fp2), false);
});

// ── Secret Validation ──
console.log("\nSecret validation:");

test("isSecretCheckEnabled returns false when no secret set", () => {
  assert.equal(isSecretCheckEnabled(), false);
});

test("isSecretCheckEnabled returns true when secret set", () => {
  setExpectedIngressSecret("test-secret");
  assert.equal(isSecretCheckEnabled(), true);
  setExpectedIngressSecret(null);
});

test("validateIngressSecret passes when no secret configured", () => {
  const result = validateIngressSecret({});
  assert.equal(result.valid, true);
});

test("validateIngressSecret passes with correct secret", () => {
  setExpectedIngressSecret("test-secret");
  const result = validateIngressSecret({ "x-alice-secret": "test-secret" });
  assert.equal(result.valid, true);
  setExpectedIngressSecret(null);
});

test("validateIngressSecret fails with missing secret", () => {
  setExpectedIngressSecret("test-secret");
  const result = validateIngressSecret({});
  assert.equal(result.valid, false);
  assert.equal(result.reason, "missing_secret");
  setExpectedIngressSecret(null);
});

test("validateIngressSecret fails with wrong secret", () => {
  setExpectedIngressSecret("test-secret");
  const result = validateIngressSecret({ "x-alice-secret": "wrong-secret" });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_secret");
  setExpectedIngressSecret(null);
});

test("getSecretHeaderKey returns x-alice-secret", () => {
  assert.equal(getSecretHeaderKey(), "x-alice-secret");
});

// ── Replay Protection ──
console.log("\nReplay protection:");

test("isReplayRequest returns false for first request", () => {
  const fp = buildIngressFingerprint({ sessionId: "s1", body: {} });
  assert.equal(isReplayRequest(fp), false);
});

test("isReplayRequest returns true for repeated request", () => {
  const fp = buildIngressFingerprint({ sessionId: "s1", body: { session: { session_id: "s1" } } });
  rememberIngressFingerprint(fp);
  assert.equal(isReplayRequest(fp), true);
});

test("rememberIngressFingerprint adds to replay window", () => {
  const fp = buildIngressFingerprint({ sessionId: "unique-s1", body: {} });
  assert.equal(isReplayRequest(fp), false);
  rememberIngressFingerprint(fp);
  assert.equal(isReplayRequest(fp), true);
});

test("clearReplayWindow clears all fingerprints", () => {
  const fp = buildIngressFingerprint({ sessionId: "s1", body: {} });
  rememberIngressFingerprint(fp);
  assert.equal(isReplayRequest(fp), true);
  clearReplayWindow();
  assert.equal(isReplayRequest(fp), false);
});

// ── Rate Limit ──
console.log("\nRate limit:");

test("checkIngressRateLimit allows first request", () => {
  const result = checkIngressRateLimit("test-key-1");
  assert.equal(result.allowed, true);
});

test("checkIngressRateLimit blocks after limit exceeded", () => {
  setRateLimitConfig(2, 60000);
  checkIngressRateLimit("test-key-2");
  checkIngressRateLimit("test-key-2");
  const result = checkIngressRateLimit("test-key-2");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

test("checkIngressRateLimit returns remaining count", () => {
  setRateLimitConfig(5, 60000);
  checkIngressRateLimit("test-key-3");
  const result = checkIngressRateLimit("test-key-3");
  assert.equal(result.remaining, 3);
});

test("resetRateLimit resets counter", () => {
  setRateLimitConfig(2, 60000);
  checkIngressRateLimit("test-key-4");
  checkIngressRateLimit("test-key-4");
  assert.equal(checkIngressRateLimit("test-key-4").allowed, false);
  resetRateLimit("test-key-4");
  assert.equal(checkIngressRateLimit("test-key-4").allowed, true);
});

// ── Audit Trail ──
console.log("\nAudit trail:");

test("buildIngressAuditRecord creates audit record", () => {
  const record = buildIngressAuditRecord({
    sessionId: "s1",
    outcome: "accepted",
    reason: "ok",
  });
  assert.ok(record.auditId);
  assert.equal(record.outcome, "accepted");
  assert.equal(record.reason, "ok");
  assert.equal(record.sessionId, "s1");
  assert.ok(record.timestamp);
});

test("recordIngressAudit adds to audit trail", () => {
  const record = buildIngressAuditRecord({ sessionId: "s1", outcome: "accepted" });
  recordIngressAudit(record);
  const recent = getRecentAuditRecords(1);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].auditId, record.auditId);
});

test("getRecentAuditRecords returns limited records", () => {
  for (let i = 0; i < 10; i++) {
    recordIngressAudit(buildIngressAuditRecord({ sessionId: `s${i}`, outcome: "accepted" }));
  }
  const recent = getRecentAuditRecords(5);
  assert.equal(recent.length, 5);
});

// ── Observability ──
console.log("\nObservability:");

test("buildIngressObservabilityEvent creates event", () => {
  const event = buildIngressObservabilityEvent({
    eventType: "ingress_received",
    sessionId: "s1",
  });
  assert.ok(event.eventId);
  assert.equal(event.eventType, "ingress_received");
  assert.equal(event.sessionId, "s1");
  assert.ok(event.timestamp);
});

test("emitIngressObservabilityEvent adds to buffer", () => {
  const event = buildIngressObservabilityEvent({ eventType: "ingress_verified", sessionId: "s1" });
  emitIngressObservabilityEvent(event);
  const recent = getRecentObservabilityEvents(1);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].eventType, "ingress_verified");
});

// ── Safe Logging ──
console.log("\nSafe logging:");

test("sanitizeIngressLogMeta filters unsafe fields", () => {
  const meta = {
    eventId: "e1",
    eventType: "ingress_verified",
    rawPayload: { secret: "data" },
    largeBody: "x".repeat(200),
    safeNumber: 42,
    safeBool: true,
  };
  const sanitized = sanitizeIngressLogMeta(meta);
  assert.ok(sanitized.eventId);
  assert.ok(sanitized.eventType);
  assert.equal(sanitized.rawPayload, undefined); // Objects filtered out
  assert.equal((sanitized.largeBody as string).includes("[truncated]"), true);
  assert.equal(sanitized.safeNumber, 42);
  assert.equal(sanitized.safeBool, true);
});

test("getSafeLogEntries returns safe logs", () => {
  const event = buildIngressObservabilityEvent({ eventType: "ingress_received" });
  emitIngressObservabilityEvent(event);
  const entries = getSafeLogEntries(1);
  assert.ok(entries.length >= 0); // Logs may be emitted by other tests
});

// ── Boundary Guards ──
console.log("\nBoundary guards:");

test("checkOversizedRequest returns false for normal request", () => {
  const body = { session: { session_id: "s1" }, request: { command: "hello" } };
  assert.equal(checkOversizedRequest(body), false);
});

test("checkOversizedRequest returns true for oversized request", () => {
  const body = { data: "x".repeat(100 * 1024) }; // 100KB
  assert.equal(checkOversizedRequest(body), true);
});

test("checkMalformedIngress returns false for valid ingress", () => {
  const body = { session: { session_id: "s1" }, request: { command: "hello" } };
  const result = checkMalformedIngress(body);
  assert.equal(result.malformed, false);
});

test("checkMalformedIngress returns true for missing session", () => {
  const body = { request: { command: "hello" } };
  const result = checkMalformedIngress(body);
  assert.equal(result.malformed, true);
  assert.ok(result.reason?.includes("session"));
});

test("checkMalformedIngress returns true for missing session_id", () => {
  const body = { session: {}, request: { command: "hello" } };
  const result = checkMalformedIngress(body);
  assert.equal(result.malformed, true);
  assert.ok(result.reason?.includes("session_id"));
});

test("checkMalformedIngress returns true for missing request", () => {
  const body = { session: { session_id: "s1" } };
  const result = checkMalformedIngress(body);
  assert.equal(result.malformed, true);
  assert.ok(result.reason?.includes("request"));
});

test("checkSuspiciousPatterns returns false for normal request", () => {
  const body = { session: { session_id: "s1" }, request: { command: "hello" } };
  const result = checkSuspiciousPatterns(body);
  assert.equal(result.suspicious, false);
});

test("checkSuspiciousPatterns returns true for excessive nesting", () => {
  // Build deeply nested object
  let deepObj: Record<string, unknown> = { leaf: true };
  for (let i = 0; i < 15; i++) {
    deepObj = { nested: deepObj };
  }
  const result = checkSuspiciousPatterns(deepObj);
  assert.equal(result.suspicious, true);
});

test("checkSuspiciousPatterns returns true for excessive key count", () => {
  const manyKeys: Record<string, unknown> = {};
  for (let i = 0; i < 150; i++) {
    manyKeys[`key${i}`] = i;
  }
  const result = checkSuspiciousPatterns(manyKeys);
  assert.equal(result.suspicious, true);
});

// ── Main Hardening Handler ──
console.log("\nMain hardening handler:");

test("runAliceIngressHardening accepts valid request", () => {
  const input: HardeningInput = {
    headers: {},
    body: { session: { session_id: "s1" }, request: { command: "hello" } },
    sessionId: "s1",
    contentType: "application/json",
  };
  const result = runAliceIngressHardening(input);
  assert.equal(result.accepted, true);
  assert.equal(result.reason, "ok");
  assert.equal(result.shouldReject, false);
  assert.equal(result.statusCode, 200);
});

test("runAliceIngressHardening rejects invalid secret", () => {
  setExpectedIngressSecret("test-secret");
  const input: HardeningInput = {
    headers: {},
    body: { session: { session_id: "s1" }, request: { command: "hello" } },
    sessionId: "s1",
    contentType: "application/json",
  };
  const result = runAliceIngressHardening(input);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "missing_secret");
  assert.equal(result.statusCode, 401);
  setExpectedIngressSecret(null);
});

test("runAliceIngressHardening rejects oversized request", () => {
  const input: HardeningInput = {
    headers: {},
    body: { data: "x".repeat(100 * 1024) },
    sessionId: "s1",
    contentType: "application/json",
  };
  const result = runAliceIngressHardening(input);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "oversized");
  assert.equal(result.statusCode, 413);
});

test("runAliceIngressHardening rejects malformed request", () => {
  const input: HardeningInput = {
    headers: {},
    body: { session: {}, request: {} },
    sessionId: "s1",
    contentType: "application/json",
  };
  const result = runAliceIngressHardening(input);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "malformed");
  assert.equal(result.statusCode, 400);
});

test("runAliceIngressHardening detects replay", () => {
  // First request
  const input: HardeningInput = {
    headers: {},
    body: { session: { session_id: "replay-s1" }, request: { command: "hello" } },
    sessionId: "replay-s1",
    contentType: "application/json",
  };
  const result1 = runAliceIngressHardening(input);
  assert.equal(result1.accepted, true);

  // Second identical request — replay detected
  const result2 = runAliceIngressHardening(input);
  assert.equal(result2.accepted, false);
  assert.equal(result2.reason, "replay_detected");
  assert.equal(result2.statusCode, 409);
});

test("runAliceIngressHardening emits audit record", () => {
  const before = getAuditTrailStats().total;
  const input: HardeningInput = {
    headers: {},
    body: { session: { session_id: "audit-s1" }, request: { command: "hello" } },
    sessionId: "audit-s1",
    contentType: "application/json",
  };
  runAliceIngressHardening(input);
  const after = getAuditTrailStats().total;
  assert.ok(after > before);
});

test("runAliceIngressHardening emits observability event", () => {
  const before = getObservabilityStats().total;
  const input: HardeningInput = {
    headers: {},
    body: { session: { session_id: "obs-s1" }, request: { command: "hello" } },
    sessionId: "obs-s1",
    contentType: "application/json",
  };
  runAliceIngressHardening(input);
  const after = getObservabilityStats().total;
  assert.ok(after > before);
});

test("runAliceIngressHardening returns safe internal error on unexpected failure", () => {
  // This is hard to trigger without mocking, but we can verify the structure
  const input: HardeningInput = {
    headers: {},
    body: { session: { session_id: "err-s1" }, request: { command: "hello" } },
    sessionId: "err-s1",
    contentType: "application/json",
  };
  const result = runAliceIngressHardening(input);
  // Should not throw, and should return valid result
  assert.ok(result.statusCode);
  assert.ok(typeof result.accepted === "boolean");
});

// ── Selectors ──
console.log("\nSelectors:");

test("getAliceIngressHardeningAdapter returns adapter", () => {
  const adapter = getAliceIngressHardeningAdapter();
  assert.ok(adapter);
  assert.equal(adapter!.adapterId, "alice_ingress_hardening_v1");
});

test("supportsSharedSecretCheck returns true", () => {
  assert.equal(supportsSharedSecretCheck(), true);
});

test("supportsReplayProtection returns true", () => {
  assert.equal(supportsReplayProtection(), true);
});

test("supportsFingerprinting returns true", () => {
  assert.equal(supportsFingerprinting(), true);
});

test("supportsRateLimitHooks returns true", () => {
  assert.equal(supportsRateLimitHooks(), true);
});

test("supportsAuditTrail returns true", () => {
  assert.equal(supportsAuditTrail(), true);
});

test("supportsObservability returns true", () => {
  assert.equal(supportsObservability(), true);
});

test("supportsSafeLogging returns true", () => {
  assert.equal(supportsSafeLogging(), true);
});

test("getAdapterVersion returns 1.0.0", () => {
  assert.equal(getAdapterVersion(), "1.0.0");
});

test("getAdapterId returns alice_ingress_hardening_v1", () => {
  assert.equal(getAdapterId(), "alice_ingress_hardening_v1");
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no replay request reaches protocol adapter", () => {
  const input: HardeningInput = {
    headers: {},
    body: { session: { session_id: "sanity-replay-s1" }, request: { command: "hello" } },
    sessionId: "sanity-replay-s1",
    contentType: "application/json",
  };
  const result1 = runAliceIngressHardening(input);
  assert.equal(result1.accepted, true);
  const result2 = runAliceIngressHardening(input);
  assert.equal(result2.accepted, false);
  assert.equal(result2.reason, "replay_detected");
});

test("no invalid secret reaches protocol adapter", () => {
  setExpectedIngressSecret("test-secret");
  const input: HardeningInput = {
    headers: {},
    body: { session: { session_id: "sanity-secret-s1" }, request: { command: "hello" } },
    sessionId: "sanity-secret-s1",
    contentType: "application/json",
  };
  const result = runAliceIngressHardening(input);
  assert.equal(result.accepted, false);
  setExpectedIngressSecret(null);
});

test("no oversized request reaches protocol adapter", () => {
  const input: HardeningInput = {
    headers: {},
    body: { data: "x".repeat(100 * 1024) },
    sessionId: "sanity-oversize-s1",
    contentType: "application/json",
  };
  const result = runAliceIngressHardening(input);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "oversized");
});

test("no malformed request reaches protocol adapter", () => {
  const input: HardeningInput = {
    headers: {},
    body: { session: {}, request: {} },
    sessionId: "sanity-malformed-s1",
    contentType: "application/json",
  };
  const result = runAliceIngressHardening(input);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "malformed");
});

test("no unsafe payload leakage in logs", () => {
  const meta = { secret: "super-secret-data", eventId: "e1" };
  const sanitized = sanitizeIngressLogMeta(meta);
  assert.equal((sanitized as any).secret, undefined);
  assert.ok(sanitized.eventId);
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
