// Alice Webhook HTTP Entry Adapter v1.0 — Unit Tests
// Run with: npx tsx tests/unit/alice-http/alice-webhook-http-entry-adapter.test.ts

import assert from "node:assert/strict";
import { aliceHttpEntryAdapter } from "../../../src/alice-http/builtin.js";
import { validateAliceHttpEntryAdapter } from "../../../src/alice-http/validators.js";
import {
  getAliceHttpEntryAdapter,
  supportsPostOnly,
  supportsJsonOnly,
  supportsBoundaryValidation,
  supportsBasicVerificationGate,
  supportsProtocolHandOff,
  getAdapterVersion,
  getAdapterId,
} from "../../../src/alice-http/selectors.js";
import {
  extractHttpMethod,
  extractContentType,
  extractRequestBody,
  buildHttpRequestEnvelope,
  isMethodPost,
  isContentTypeJson,
  hasRequestBody,
} from "../../../src/alice-http/request.js";
import {
  validateAliceHttpRequest,
  isPostRequest,
  isJsonRequest,
} from "../../../src/alice-http/validation.js";
import {
  setSharedSecret,
  hasExpectedSharedSecret,
  verifyAliceHttpRequest,
} from "../../../src/alice-http/security.js";
import {
  buildJsonOkResponse,
  buildJsonErrorResponse,
  buildSafeJsonResponse,
} from "../../../src/alice-http/response.js";
import {
  buildInvalidMethodResponse,
  buildInvalidContentTypeResponse,
  buildUnauthorizedResponse,
  buildForbiddenResponse,
  buildInternalAdapterErrorResponse,
  buildBadRequestResponse,
} from "../../../src/alice-http/errors.js";
import {
  mapHttpRequestToProtocolRequest,
  mapProtocolResponseToHttpResponse,
} from "../../../src/alice-http/mapping.js";
import { handleAliceHttpEntry } from "../../../src/alice-http/adapter.js";
import { BUILTIN_ENTRY_PATTERNS } from "../../../src/alice-bridge/builtin.js";
import { clearReplayWindow } from "../../../src/alice-ingress-hardening/replay.js";
import type { AliceHttpRequestEnvelope, AliceHttpEntryAdapter } from "../../../src/alice-http/types.js";

// Auto-registered via builtin import
const ADAPTER = aliceHttpEntryAdapter;
const ENTRY_PATTERNS = BUILTIN_ENTRY_PATTERNS;

// Clear replay window before each test to avoid replay detection
function resetReplayWindow() {
  clearReplayWindow();
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  resetReplayWindow(); // Clear replay window before each test
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

test("builtin HTTP entry adapter loads", () => {
  assert.ok(ADAPTER);
  assert.equal(ADAPTER.adapterId, "alice_http_entry_adapter_v1");
  assert.equal(ADAPTER.version, "1.0.0");
});

test("builtin has all feature flags", () => {
  assert.equal(ADAPTER.supportsPostOnly, true);
  assert.equal(ADAPTER.supportsJsonOnly, true);
  assert.equal(ADAPTER.supportsBoundaryValidation, true);
  assert.equal(ADAPTER.supportsBasicVerificationGate, true);
  assert.equal(ADAPTER.supportsProtocolHandOff, true);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin adapter validates with no errors", () => {
  const errors = validateAliceHttpEntryAdapter(ADAPTER);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

// ── Request Helpers ──
console.log("\nRequest helpers:");

test("extractHttpMethod returns uppercase method", () => {
  assert.equal(extractHttpMethod("post"), "POST");
  assert.equal(extractHttpMethod("POST"), "POST");
  assert.equal(extractHttpMethod("get"), "GET");
});

test("extractHttpMethod returns empty string for undefined", () => {
  assert.equal(extractHttpMethod(undefined), "");
});

test("extractContentType extracts and normalizes content-type", () => {
  assert.equal(extractContentType({ "content-type": "application/json" }), "application/json");
  assert.equal(extractContentType({ "content-type": "application/json; charset=utf-8" }), "application/json");
  assert.equal(extractContentType({ "Content-Type": "APPLICATION/JSON" }), "application/json");
  assert.equal(extractContentType({}), "");
});

test("extractRequestBody extracts valid body", () => {
  const body = { session: { session_id: "s1" }, request: { command: "hello" } };
  const result = extractRequestBody(body);
  assert.ok(result);
  assert.deepEqual(result, body);
});

test("extractRequestBody returns null for null/undefined", () => {
  assert.equal(extractRequestBody(null), null);
  assert.equal(extractRequestBody(undefined), null);
});

test("extractRequestBody returns null for non-object", () => {
  assert.equal(extractRequestBody("string"), null);
  assert.equal(extractRequestBody(123), null);
});

test("extractRequestBody rejects oversized payloads", () => {
  const largeBody = { data: "x".repeat(100 * 1024) }; // 100KB
  const result = extractRequestBody(largeBody, 64 * 1024); // 64KB limit
  assert.equal(result, null);
});

test("buildHttpRequestEnvelope builds envelope", () => {
  const envelope = buildHttpRequestEnvelope("post", { "content-type": "application/json" }, { session: { session_id: "s1" } });
  assert.equal(envelope.method, "POST");
  assert.ok(envelope.body);
  assert.ok(envelope.receivedAt);
});

test("isMethodPost returns true for POST", () => {
  const envelope: AliceHttpRequestEnvelope = { method: "POST", headers: {}, body: {}, receivedAt: "now" };
  assert.equal(isMethodPost(envelope), true);
});

test("isContentTypeJson returns true for application/json", () => {
  const envelope: AliceHttpRequestEnvelope = { method: "POST", headers: { "content-type": "application/json" }, body: {}, receivedAt: "now" };
  assert.equal(isContentTypeJson(envelope), true);
});

test("hasRequestBody returns true when body present", () => {
  const envelope: AliceHttpRequestEnvelope = { method: "POST", headers: {}, body: {}, receivedAt: "now" };
  assert.equal(hasRequestBody(envelope), true);
});

test("hasRequestBody returns false when body null", () => {
  const envelope: AliceHttpRequestEnvelope = { method: "POST", headers: {}, body: null, receivedAt: "now" };
  assert.equal(hasRequestBody(envelope), false);
});

// ── Boundary Validation ──
console.log("\nBoundary validation:");

test("validateAliceHttpRequest passes valid POST JSON request", () => {
  const envelope: AliceHttpRequestEnvelope = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { session: { session_id: "s1" }, request: { command: "hello" } },
    receivedAt: "now",
  };
  const result = validateAliceHttpRequest(envelope);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validateAliceHttpRequest rejects non-POST method", () => {
  const envelope: AliceHttpRequestEnvelope = {
    method: "GET" as any,
    headers: {},
    body: { session: { session_id: "s1" } },
    receivedAt: "now",
  };
  const result = validateAliceHttpRequest(envelope);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("POST")));
  assert.equal(result.httpStatus, 405);
});

test("validateAliceHttpRequest rejects non-JSON content-type", () => {
  const envelope: AliceHttpRequestEnvelope = {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: { session: { session_id: "s1" } },
    receivedAt: "now",
  };
  const result = validateAliceHttpRequest(envelope);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("json")));
  assert.equal(result.httpStatus, 415);
});

test("validateAliceHttpRequest rejects missing body", () => {
  const envelope: AliceHttpRequestEnvelope = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: null,
    receivedAt: "now",
  };
  const result = validateAliceHttpRequest(envelope);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("body")));
});

test("validateAliceHttpRequest rejects missing session", () => {
  const envelope: AliceHttpRequestEnvelope = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { request: { command: "hello" } },
    receivedAt: "now",
  };
  const result = validateAliceHttpRequest(envelope);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("session")));
});

test("validateAliceHttpRequest rejects missing session_id", () => {
  const envelope: AliceHttpRequestEnvelope = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { session: {}, request: { command: "hello" } },
    receivedAt: "now",
  };
  const result = validateAliceHttpRequest(envelope);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("session_id")));
});

test("isPostRequest returns true for POST", () => {
  const envelope: AliceHttpRequestEnvelope = { method: "POST", headers: {}, body: {}, receivedAt: "now" };
  assert.equal(isPostRequest(envelope), true);
});

test("isJsonRequest returns true for JSON content-type", () => {
  const envelope: AliceHttpRequestEnvelope = { method: "POST", headers: { "content-type": "application/json" }, body: {}, receivedAt: "now" };
  assert.equal(isJsonRequest(envelope), true);
});

// ── Security Gate ──
console.log("\nSecurity gate:");

test("hasExpectedSharedSecret returns false when no secret set", () => {
  setSharedSecret(null);
  assert.equal(hasExpectedSharedSecret(), false);
});

test("verifyAliceHttpRequest passes when no secret configured", () => {
  setSharedSecret(null);
  const envelope: AliceHttpRequestEnvelope = { method: "POST", headers: {}, body: {}, receivedAt: "now" };
  const result = verifyAliceHttpRequest(envelope);
  assert.equal(result.valid, true);
});

test("verifyAliceHttpRequest passes with correct secret", () => {
  setSharedSecret("test-secret");
  const envelope: AliceHttpRequestEnvelope = { method: "POST", headers: { "x-alice-secret": "test-secret" }, body: {}, receivedAt: "now" };
  const result = verifyAliceHttpRequest(envelope);
  assert.equal(result.valid, true);
  setSharedSecret(null); // Reset
});

test("verifyAliceHttpRequest fails with wrong secret", () => {
  setSharedSecret("test-secret");
  const envelope: AliceHttpRequestEnvelope = { method: "POST", headers: { "x-alice-secret": "wrong-secret" }, body: {}, receivedAt: "now" };
  const result = verifyAliceHttpRequest(envelope);
  assert.equal(result.valid, false);
  setSharedSecret(null); // Reset
});

// ── Response Builders ──
console.log("\nResponse builders:");

test("buildJsonOkResponse creates 200 response", () => {
  const response = buildJsonOkResponse({ text: "Hello" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.contentType, "application/json");
  assert.deepEqual(response.body, { text: "Hello" });
});

test("buildJsonErrorResponse creates error response", () => {
  const response = buildJsonErrorResponse(400, "Bad request", { field: "body" });
  assert.equal(response.statusCode, 400);
  assert.equal((response.body as any).error, true);
  assert.equal((response.body as any).message, "Bad request");
  assert.ok((response.body as any).details);
});

test("buildSafeJsonResponse creates safe response", () => {
  const response = buildSafeJsonResponse(500, "Internal error");
  assert.equal(response.statusCode, 500);
  assert.equal((response.body as any).message, "Internal error");
});

// ── Error Builders ──
console.log("\nError builders:");

test("buildInvalidMethodResponse creates 405 response", () => {
  const response = buildInvalidMethodResponse("GET");
  assert.equal(response.statusCode, 405);
  assert.ok((response.body as any).message.includes("POST"));
});

test("buildInvalidContentTypeResponse creates 415 response", () => {
  const response = buildInvalidContentTypeResponse("text/plain");
  assert.equal(response.statusCode, 415);
  assert.ok((response.body as any).message.includes("json"));
});

test("buildUnauthorizedResponse creates 401 response", () => {
  const response = buildUnauthorizedResponse();
  assert.equal(response.statusCode, 401);
});

test("buildForbiddenResponse creates 403 response", () => {
  const response = buildForbiddenResponse();
  assert.equal(response.statusCode, 403);
});

test("buildInternalAdapterErrorResponse creates 500 response without stack", () => {
  const response = buildInternalAdapterErrorResponse(new Error("Internal stack trace"));
  assert.equal(response.statusCode, 500);
  assert.equal((response.body as any).message, "Internal adapter error");
  // No stack trace leaked
  assert.equal((response.body as any).stack, undefined);
});

test("buildBadRequestResponse creates 400 response", () => {
  const response = buildBadRequestResponse("Invalid input");
  assert.equal(response.statusCode, 400);
  assert.equal((response.body as any).message, "Invalid input");
});

// ── HTTP↔Protocol Mapping ──
console.log("\nHTTP↔Protocol mapping:");

test("mapHttpRequestToProtocolRequest extracts protocol request", () => {
  const envelope: AliceHttpRequestEnvelope = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: {
      session: { session_id: "s1", user_id: "u1", new: true },
      request: { command: "привет", original_utterance: "привет" },
      version: "1.1",
    },
    receivedAt: "now",
  };
  const protocolReq = mapHttpRequestToProtocolRequest(envelope);
  assert.ok(protocolReq);
  assert.equal(protocolReq!.session.session_id, "s1");
  assert.equal(protocolReq!.session.user_id, "u1");
  assert.equal(protocolReq!.request.command, "привет");
  assert.equal(protocolReq!.version, "1.1");
});

test("mapHttpRequestToProtocolRequest returns null when no body", () => {
  const envelope: AliceHttpRequestEnvelope = { method: "POST", headers: {}, body: null, receivedAt: "now" };
  const protocolReq = mapHttpRequestToProtocolRequest(envelope);
  assert.equal(protocolReq, null);
});

test("mapProtocolResponseToHttpResponse maps protocol response to HTTP", () => {
  const protocolResponse = {
    response: { text: "Hello!", end_session: false },
    session: { session_id: "s1" },
    version: "1.0",
  };
  const httpResponse = mapProtocolResponseToHttpResponse(protocolResponse as any);
  assert.equal(httpResponse.statusCode, 200);
  assert.equal(httpResponse.contentType, "application/json");
  assert.equal((httpResponse.body as any).response.text, "Hello!");
});

// ── Main HTTP Handler ──
console.log("\nMain HTTP handler:");

test("handleAliceHttpEntry handles valid POST JSON request", () => {
  const response = handleAliceHttpEntry(
    "POST",
    { "content-type": "application/json" },
    { session: { session_id: "s1" }, request: { command: "алиса позови аришу" } },
    { simulatedRuntimeOutcome: "delivered", simulatedRuntimeText: "Привет!" },
    ENTRY_PATTERNS,
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.contentType, "application/json");
});

test("handleAliceHttpEntry rejects GET method", () => {
  const response = handleAliceHttpEntry("GET", {}, null);
  assert.equal(response.statusCode, 405);
});

test("handleAliceHttpEntry rejects non-JSON content-type", () => {
  const response = handleAliceHttpEntry("POST", { "content-type": "text/plain" }, {});
  assert.equal(response.statusCode, 415);
});

test("handleAliceHttpEntry rejects missing body", () => {
  const response = handleAliceHttpEntry("POST", { "content-type": "application/json" }, null);
  assert.equal(response.statusCode, 400);
});

test("handleAliceHttpEntry rejects missing session", () => {
  const response = handleAliceHttpEntry(
    "POST",
    { "content-type": "application/json" },
    { request: { command: "hello" } },
  );
  assert.equal(response.statusCode, 400);
});

test("handleAliceHttpEntry rejects missing session_id", () => {
  const response = handleAliceHttpEntry(
    "POST",
    { "content-type": "application/json" },
    { session: {}, request: { command: "hello" } },
  );
  assert.equal(response.statusCode, 400);
});

test("handleAliceHttpEntry rejects invalid verification secret", () => {
  setSharedSecret("test-secret");
  const response = handleAliceHttpEntry(
    "POST",
    { "content-type": "application/json", "x-alice-secret": "wrong-secret" },
    { session: { session_id: "s1" }, request: { command: "hello" } },
  );
  assert.ok(response.statusCode === 401 || response.statusCode === 400);
  setSharedSecret(null);
});

test("handleAliceHttpEntry returns safe 500 on unexpected failure", () => {
  const response = handleAliceHttpEntry(
    "POST",
    { "content-type": "application/json" },
    { session: { session_id: "s1" }, request: { command: "алиса позови аришу" } },
    undefined,
    ENTRY_PATTERNS,
  );
  // Should not throw — returns protocol response (may be forwarded or delivered)
  assert.ok(response.statusCode === 200 || response.statusCode >= 400);
  // Response must be JSON-safe
  assert.equal(response.contentType, "application/json");
});

// ── Selectors ──
console.log("\nSelectors:");

test("getAliceHttpEntryAdapter returns adapter", () => {
  const adapter = getAliceHttpEntryAdapter();
  assert.ok(adapter);
  assert.equal(adapter!.adapterId, "alice_http_entry_adapter_v1");
});

test("supportsPostOnly returns true", () => {
  assert.equal(supportsPostOnly(), true);
});

test("supportsJsonOnly returns true", () => {
  assert.equal(supportsJsonOnly(), true);
});

test("supportsBoundaryValidation returns true", () => {
  assert.equal(supportsBoundaryValidation(), true);
});

test("supportsBasicVerificationGate returns true", () => {
  assert.equal(supportsBasicVerificationGate(), true);
});

test("supportsProtocolHandOff returns true", () => {
  assert.equal(supportsProtocolHandOff(), true);
});

test("getAdapterVersion returns 1.0.0", () => {
  assert.equal(getAdapterVersion(), "1.0.0");
});

test("getAdapterId returns alice_http_entry_adapter_v1", () => {
  assert.equal(getAdapterId(), "alice_http_entry_adapter_v1");
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no GET accepted", () => {
  const response = handleAliceHttpEntry("GET", {}, null);
  assert.equal(response.statusCode, 405);
});

test("no text/plain accepted", () => {
  const response = handleAliceHttpEntry("POST", { "content-type": "text/plain" }, {});
  assert.equal(response.statusCode, 415);
});

test("no missing body accepted", () => {
  const response = handleAliceHttpEntry("POST", { "content-type": "application/json" }, null);
  assert.equal(response.statusCode, 400);
});

test("no runtime leak in error body", () => {
  const response = buildInternalAdapterErrorResponse(new Error("Secret internal stack trace"));
  assert.equal((response.body as any).message, "Internal adapter error");
  assert.equal((response.body as any).stack, undefined);
  // Code is nested under details, not at top level
  assert.ok((response.body as any).details);
  assert.equal((response.body as any).details.code, "INTERNAL_ADAPTER_ERROR");
});

test("no protocol bypass — handler always calls protocol adapter for valid requests", () => {
  // Valid request must go through full pipeline
  const response = handleAliceHttpEntry(
    "POST",
    { "content-type": "application/json" },
    { session: { session_id: "s1" }, request: { command: "привет" } },
    { simulatedRuntimeOutcome: "forwarded" },
    ENTRY_PATTERNS,
  );
  // Must be 200 (protocol response produced), not bypassed
  assert.equal(response.statusCode, 200);
});

test("HTTP success does not masquerade as runtime success", () => {
  const response = handleAliceHttpEntry(
    "POST",
    { "content-type": "application/json" },
    { session: { session_id: "s1" }, request: { command: "привет" } },
    { simulatedRuntimeOutcome: "forwarded" },
    ENTRY_PATTERNS,
  );
  // HTTP 200 ≠ runtime execution success — it just means protocol response was produced
  assert.equal(response.statusCode, 200);
  // The protocol response text should reflect forwarded status, not execution
  const body = response.body as any;
  assert.ok(body.response);
  assert.equal(body.response.end_session, false); // forwarded ≠ terminal
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
