// Alice Request/Response Protocol Adapter v1.0 — Unit Tests
// Run with: npx tsx tests/unit/alice-protocol/alice-request-response-protocol-adapter.test.ts

import assert from "node:assert/strict";
import { aliceProtocolAdapter } from "../../../src/alice-protocol/builtin.js";
import { validateAliceProtocolAdapter, validateProtocolRequest } from "../../../src/alice-protocol/validators.js";
import {
  getAliceProtocolAdapter,
  supportsProtocolValidation,
  supportsRequestNormalization,
  supportsResponseMapping,
  supportsTruthfulEndSession,
  getSafeProtocolVersion,
  getAdapterVersion,
  getAdapterId,
} from "../../../src/alice-protocol/selectors.js";
import {
  extractAliceText,
  extractAliceSessionMeta,
  hasExtractableText,
  isProtocolRequestValid,
} from "../../../src/alice-protocol/request.js";
import {
  normalizeAliceProtocolRequest,
  detectProtocolLanguage,
  isValidAliceProtocolRequest,
} from "../../../src/alice-protocol/normalization.js";
import { mapBridgeResponseToProtocolResponse } from "../../../src/alice-protocol/mapping.js";
import {
  buildAliceProtocolResponse,
  buildSafeProtocolErrorResponse,
} from "../../../src/alice-protocol/response.js";
import { shouldEndAliceSession, isOutcomeTerminal, canContinueSession } from "../../../src/alice-protocol/closure.js";
import {
  assertProtocolTruth,
  buildProtocolTruthSummary,
  isProtocolResponseValid,
  validateProtocolResponse,
} from "../../../src/alice-protocol/truth.js";
import { handleAliceProtocolRequest } from "../../../src/alice-protocol/adapter.js";
import { BUILTIN_ENTRY_PATTERNS } from "../../../src/alice-bridge/builtin.js";
import type { AliceProtocolRequest, EntryPattern } from "../../../src/alice-protocol/types.js";

// Auto-registered via builtin import
const ADAPTER = aliceProtocolAdapter;
const ENTRY_PATTERNS = BUILTIN_ENTRY_PATTERNS;

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
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

test("builtin protocol adapter loads", () => {
  assert.ok(ADAPTER);
  assert.equal(ADAPTER.adapterId, "alice_protocol_adapter_v1");
  assert.equal(ADAPTER.version, "1.0.0");
});

test("builtin has all feature flags", () => {
  assert.equal(ADAPTER.supportsProtocolValidation, true);
  assert.equal(ADAPTER.supportsRequestNormalization, true);
  assert.equal(ADAPTER.supportsResponseMapping, true);
  assert.equal(ADAPTER.supportsTruthfulEndSession, true);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin adapter validates with no errors", () => {
  const errors = validateAliceProtocolAdapter(ADAPTER);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

// ── Request Parsing ──
console.log("\nRequest parsing:");

test("extractAliceText extracts from command", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "привет" },
  };
  assert.equal(extractAliceText(request), "привет");
});

test("extractAliceText falls back to original_utterance", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { original_utterance: "как дела" },
  };
  assert.equal(extractAliceText(request), "как дела");
});

test("extractAliceText prefers command over original_utterance", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "command text", original_utterance: "utterance text" },
  };
  assert.equal(extractAliceText(request), "command text");
});

test("extractAliceText returns empty string when no text", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: {},
  };
  assert.equal(extractAliceText(request), "");
});

test("extractAliceSessionMeta extracts all fields", () => {
  const request: AliceProtocolRequest = {
    meta: { locale: "ru-RU", timezone: "Europe/Moscow", client_id: "c1" },
    session: { session_id: "s1", user_id: "u1", new: true },
    version: "1.1",
  };
  const meta = extractAliceSessionMeta(request);
  assert.equal(meta.sessionId, "s1");
  assert.equal(meta.userId, "u1");
  assert.equal(meta.isNew, true);
  assert.equal(meta.locale, "ru-RU");
  assert.equal(meta.timezone, "Europe/Moscow");
  assert.equal(meta.protocolVersion, "1.1");
});

test("extractAliceSessionMeta uses defaults for missing fields", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
  };
  const meta = extractAliceSessionMeta(request);
  assert.equal(meta.isNew, false);
  assert.equal(meta.protocolVersion, "1.0");
  assert.equal(meta.locale, undefined);
});

test("hasExtractableText returns true when text present", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "hello" },
  };
  assert.equal(hasExtractableText(request), true);
});

test("hasExtractableText returns false when no text", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: {},
  };
  assert.equal(hasExtractableText(request), false);
});

test("isProtocolRequestValid returns true for valid request", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "hello" },
  };
  assert.equal(isProtocolRequestValid(request), true);
});

test("isProtocolRequestValid returns false when missing session_id", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "" },
    request: { command: "hello" },
  };
  assert.equal(isProtocolRequestValid(request), false);
});

// ── Normalization ──
console.log("\nNormalization:");

test("normalizeAliceProtocolRequest normalizes valid request", () => {
  const request: AliceProtocolRequest = {
    meta: { locale: "ru-RU" },
    session: { session_id: "s1", user_id: "u1" },
    request: { command: "привет" },
  };
  const normalized = normalizeAliceProtocolRequest(request, ENTRY_PATTERNS);
  assert.equal(normalized.text, "привет");
  assert.equal(normalized.languageCode, "ru");
  assert.equal(normalized.entryIntent, "plain_voice_turn");
  assert.equal(normalized.valid, true);
  assert.equal(normalized.session.sessionId, "s1");
});

test("normalizeAliceProtocolRequest detects arisha entry", () => {
  const request: AliceProtocolRequest = {
    meta: { locale: "ru-RU" },
    session: { session_id: "s1" },
    request: { command: "алиса позови аришу" },
  };
  const normalized = normalizeAliceProtocolRequest(request, ENTRY_PATTERNS);
  assert.equal(normalized.entryIntent, "arisha_entry");
});

test("normalizeAliceProtocolRequest marks invalid request", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "" },
    request: {},
  };
  const normalized = normalizeAliceProtocolRequest(request, ENTRY_PATTERNS);
  assert.equal(normalized.valid, false);
  assert.ok(normalized.validationErrors);
});

test("detectProtocolLanguage detects ru/en/uz", () => {
  assert.equal(detectProtocolLanguage("ru-RU"), "ru");
  assert.equal(detectProtocolLanguage("en-US"), "en");
  assert.equal(detectProtocolLanguage("uz-UZ"), "uz");
});

test("detectProtocolLanguage defaults to ru", () => {
  assert.equal(detectProtocolLanguage("unknown"), "ru");
});

test("isValidAliceProtocolRequest returns true for valid request", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "hello" },
  };
  assert.equal(isValidAliceProtocolRequest(request), true);
});

test("isValidAliceProtocolRequest returns false for missing session_id", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "" },
    request: { command: "hello" },
  };
  assert.equal(isValidAliceProtocolRequest(request), false);
});

// ── Response Mapping ──
console.log("\nResponse mapping:");

test("mapBridgeResponseToProtocolResponse maps delivered response", () => {
  const bridgeResponse = {
    requestId: "req-1",
    bridgeSessionId: "bridge-1",
    runtimeSessionId: "runtime-1",
    outcome: "delivered" as const,
    responseText: "Hello from Arisha!",
  };
  const protocolResponse = mapBridgeResponseToProtocolResponse(bridgeResponse);
  assert.equal(protocolResponse.response.text, "Hello from Arisha!");
  assert.equal(protocolResponse.response.end_session, false);
  assert.equal(protocolResponse.version, "1.0");
});

test("mapBridgeResponseToProtocolResponse maps blocked response with end_session=true", () => {
  const bridgeResponse = {
    requestId: "req-1",
    outcome: "blocked" as const,
  };
  const protocolResponse = mapBridgeResponseToProtocolResponse(bridgeResponse);
  assert.equal(protocolResponse.response.end_session, true);
});

test("mapBridgeResponseToProtocolResponse maps failed response with end_session=true", () => {
  const bridgeResponse = {
    requestId: "req-1",
    outcome: "failed" as const,
  };
  const protocolResponse = mapBridgeResponseToProtocolResponse(bridgeResponse);
  assert.equal(protocolResponse.response.end_session, true);
});

test("mapBridgeResponseToProtocolResponse maps forwarded with end_session=false", () => {
  const bridgeResponse = {
    requestId: "req-1",
    outcome: "forwarded" as const,
  };
  const protocolResponse = mapBridgeResponseToProtocolResponse(bridgeResponse);
  assert.equal(protocolResponse.response.end_session, false);
});

test("mapBridgeResponseToProtocolResponse uses default text when responseText missing", () => {
  const bridgeResponse = {
    requestId: "req-1",
    outcome: "delivered" as const,
  };
  const protocolResponse = mapBridgeResponseToProtocolResponse(bridgeResponse);
  assert.ok(protocolResponse.response.text.length > 0);
});

// ── End Session Logic ──
console.log("\nEnd session logic:");

test("shouldEndAliceSession returns true for blocked", () => {
  assert.equal(shouldEndAliceSession("blocked"), true);
});

test("shouldEndAliceSession returns true for failed", () => {
  assert.equal(shouldEndAliceSession("failed"), true);
});

test("shouldEndAliceSession returns false for delivered", () => {
  assert.equal(shouldEndAliceSession("delivered"), false);
});

test("shouldEndAliceSession returns false for forwarded", () => {
  assert.equal(shouldEndAliceSession("forwarded"), false);
});

test("shouldEndAliceSession returns true when explicit close flag set", () => {
  assert.equal(shouldEndAliceSession("delivered", true), true);
});

test("isOutcomeTerminal returns true for blocked/failed", () => {
  assert.equal(isOutcomeTerminal("blocked"), true);
  assert.equal(isOutcomeTerminal("failed"), true);
  assert.equal(isOutcomeTerminal("delivered"), false);
});

test("canContinueSession returns true for non-terminal outcomes", () => {
  assert.equal(canContinueSession("delivered"), true);
  assert.equal(canContinueSession("forwarded"), true);
  assert.equal(canContinueSession("blocked"), false);
});

// ── Response Builders ──
console.log("\nResponse builders:");

test("buildAliceProtocolResponse creates valid response", () => {
  const response = buildAliceProtocolResponse({
    sessionId: "s1",
    text: "Hello!",
    endSession: false,
  });
  assert.equal(response.response.text, "Hello!");
  assert.equal(response.response.end_session, false);
  assert.equal(response.session.session_id, "s1");
  assert.equal(response.version, "1.0");
});

test("buildAliceProtocolResponse throws for empty text", () => {
  assert.throws(() =>
    buildAliceProtocolResponse({
      sessionId: "s1",
      text: "",
      endSession: false,
    }),
  );
});

test("buildSafeProtocolErrorResponse creates safe response", () => {
  const response = buildSafeProtocolErrorResponse({
    sessionId: "s1",
    text: "Ошибка обработки.",
  });
  assert.equal(response.response.text, "Ошибка обработки.");
  assert.equal(response.response.end_session, true);
  assert.equal(response.session.session_id, "s1");
});

test("buildSafeProtocolErrorResponse uses default text when not provided", () => {
  const response = buildSafeProtocolErrorResponse({ sessionId: "s1" });
  assert.ok(response.response.text.length > 0);
  assert.equal(response.response.end_session, true);
});

// ── Truth Helpers ──
console.log("\nTruth helpers:");

test("assertProtocolTruth passes for valid response", () => {
  const response = buildAliceProtocolResponse({
    sessionId: "s1",
    text: "Hello!",
    endSession: false,
  });
  assert.equal(assertProtocolTruth(response), null);
});

test("assertProtocolTruth fails for empty text", () => {
  const response = buildAliceProtocolResponse({
    sessionId: "s1",
    text: "Hello!",
    endSession: false,
  });
  (response as any).response.text = "";
  assert.ok(assertProtocolTruth(response));
});

test("assertProtocolTruth fails for missing session_id", () => {
  const response = buildAliceProtocolResponse({
    sessionId: "s1",
    text: "Hello!",
    endSession: false,
  });
  (response as any).session.session_id = "";
  assert.ok(assertProtocolTruth(response));
});

test("buildProtocolTruthSummary returns descriptive string", () => {
  const summary = buildProtocolTruthSummary("delivered", false, "s1");
  assert.ok(summary.length > 0);
  assert.ok(summary.includes("delivered"));
});

test("isProtocolResponseValid returns true for valid response", () => {
  const response = buildAliceProtocolResponse({
    sessionId: "s1",
    text: "Hello!",
    endSession: false,
  });
  assert.equal(isProtocolResponseValid(response), true);
});

test("validateProtocolResponse catches empty text", () => {
  const response = buildAliceProtocolResponse({
    sessionId: "s1",
    text: "Hello!",
    endSession: false,
  });
  (response as any).response.text = "";
  const errors = validateProtocolResponse(response);
  assert.ok(errors.length > 0);
});

// ── Main Handler ──
console.log("\nMain handler:");

test("handleAliceProtocolRequest handles valid protocol request", () => {
  const request: AliceProtocolRequest = {
    meta: { locale: "ru-RU" },
    session: { session_id: "s1", user_id: "u1" },
    request: { command: "алиса позови аришу" },
  };
  const response = handleAliceProtocolRequest(request, {
    simulatedRuntimeOutcome: "delivered",
    simulatedRuntimeText: "Привет! Я Ариша.",
  }, ENTRY_PATTERNS);
  assert.ok(response.response.text.length > 0);
  assert.equal(response.response.end_session, false);
  assert.equal(response.session.session_id, "s1");
});

test("handleAliceProtocolRequest handles invalid request (no text)", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: {},
  };
  const response = handleAliceProtocolRequest(request, undefined, ENTRY_PATTERNS);
  assert.equal(response.response.end_session, true);
  assert.ok(response.response.text.length > 0);
});

test("handleAliceProtocolRequest handles blocked outcome", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "алиса позови аришу" },
  };
  const response = handleAliceProtocolRequest(request, {
    simulatedRuntimeOutcome: "blocked",
  }, ENTRY_PATTERNS);
  assert.equal(response.response.end_session, true);
});

test("handleAliceProtocolRequest handles failed outcome", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "алиса позови аришу" },
  };
  const response = handleAliceProtocolRequest(request, {
    simulatedRuntimeOutcome: "failed",
  }, ENTRY_PATTERNS);
  assert.equal(response.response.end_session, true);
});

test("handleAliceProtocolRequest handles forwarded outcome", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "привет" },
  };
  const response = handleAliceProtocolRequest(request, {
    simulatedRuntimeOutcome: "forwarded",
  }, ENTRY_PATTERNS);
  assert.equal(response.response.end_session, false);
});

// ── Selectors ──
console.log("\nSelectors:");

test("getAliceProtocolAdapter returns adapter", () => {
  const adapter = getAliceProtocolAdapter();
  assert.ok(adapter);
  assert.equal(adapter!.adapterId, "alice_protocol_adapter_v1");
});

test("supportsProtocolValidation returns true", () => {
  assert.equal(supportsProtocolValidation(), true);
});

test("supportsRequestNormalization returns true", () => {
  assert.equal(supportsRequestNormalization(), true);
});

test("supportsResponseMapping returns true", () => {
  assert.equal(supportsResponseMapping(), true);
});

test("supportsTruthfulEndSession returns true", () => {
  assert.equal(supportsTruthfulEndSession(), true);
});

test("getSafeProtocolVersion returns 1.0", () => {
  assert.equal(getSafeProtocolVersion(), "1.0");
});

test("getAdapterVersion returns 1.0.0", () => {
  assert.equal(getAdapterVersion(), "1.0.0");
});

test("getAdapterId returns alice_protocol_adapter_v1", () => {
  assert.equal(getAdapterId(), "alice_protocol_adapter_v1");
});

// ── Request Validation ──
console.log("\nRequest validation:");

test("validateProtocolRequest passes for valid request", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "hello" },
  };
  const errors = validateProtocolRequest(request);
  assert.equal(errors.length, 0);
});

test("validateProtocolRequest fails for missing session_id", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "" },
    request: { command: "hello" },
  };
  const errors = validateProtocolRequest(request);
  assert.ok(errors.length > 0);
});

test("validateProtocolRequest fails for missing request object", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: undefined as any,
  };
  const errors = validateProtocolRequest(request);
  assert.ok(errors.length > 0);
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no empty protocol response text", () => {
  const response = buildSafeProtocolErrorResponse({ sessionId: "s1" });
  assert.ok(response.response.text.length > 0);
});

test("no runtime success implied from protocol validity", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "алиса позови аришу" },
  };
  const response = handleAliceProtocolRequest(request, {
    simulatedRuntimeOutcome: "forwarded",
  }, ENTRY_PATTERNS);
  // forwarded ≠ delivered/execution success
  assert.equal(response.response.end_session, false);
});

test("no end_session=false on blocked path", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "алиса позови аришу" },
  };
  const response = handleAliceProtocolRequest(request, {
    simulatedRuntimeOutcome: "blocked",
  }, ENTRY_PATTERNS);
  assert.equal(response.response.end_session, true);
});

test("no missing session_id acceptance", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "" },
    request: { command: "hello" },
  };
  const normalized = normalizeAliceProtocolRequest(request, ENTRY_PATTERNS);
  assert.equal(normalized.valid, false);
});

test("protocol response version defaults to 1.0", () => {
  const request: AliceProtocolRequest = {
    session: { session_id: "s1" },
    request: { command: "привет" },
  };
  const response = handleAliceProtocolRequest(request, {
    simulatedRuntimeOutcome: "forwarded",
  }, ENTRY_PATTERNS);
  assert.equal(response.version, "1.0");
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
