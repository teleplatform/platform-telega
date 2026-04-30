// Alice Voice Bridge Adapter v1.0 — Unit Tests
// Run with: npx tsx tests/unit/alice-bridge/alice-voice-bridge-adapter.test.ts

import assert from "node:assert/strict";
import { aliceVoiceBridgeAdapter, BUILTIN_ENTRY_PATTERNS } from "../../../src/alice-bridge/builtin.js";
import { validateAliceBridgeAdapter, validateEntryPatterns, validateAliceBridgeResponse } from "../../../src/alice-bridge/validators.js";
import {
  getAliceBridgeAdapter,
  supportsArishaEntryDetection,
  supportsSessionBinding,
  supportsTransportTruth,
  supportsFallbackToTextSurface,
  getSupportedEntryPatterns,
  getAdapterVersion,
  getAdapterId,
} from "../../../src/alice-bridge/selectors.js";
import {
  normalizeAliceRequest,
  detectAliceLanguage,
  detectArishaEntryIntent,
  isValidNormalizedInput,
} from "../../../src/alice-bridge/normalization.js";
import {
  openAliceBridgeSession,
  bindRuntimeSession,
  isSessionActive,
  deactivateSession,
} from "../../../src/alice-bridge/entry.js";
import {
  buildDeliveredResponse,
  buildAckResponse,
  buildForwardedResponse,
  buildOpenedResponse,
  requiresResponseText,
} from "../../../src/alice-bridge/delivery.js";
import {
  buildFallbackResponse,
  canFallbackFromAlice,
} from "../../../src/alice-bridge/fallback.js";
import {
  buildInterruptedResponse,
  buildFailedResponse,
} from "../../../src/alice-bridge/interruptions.js";
import {
  assertAliceTransportTruth,
  buildTruthSummary,
  isDeliveredDistinctFromExecuted,
  isOutcomeTerminal,
} from "../../../src/alice-bridge/truth.js";
import { handleAliceVoiceRequest } from "../../../src/alice-bridge/adapter.js";
import type {
  AliceVoiceRequest,
  AliceBridgeSession,
  AliceBridgeResponse,
  EntryPattern,
} from "../../../src/alice-bridge/types.js";

// Auto-registered via builtin import
const ADAPTER = aliceVoiceBridgeAdapter;
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

test("builtin adapter loads", () => {
  assert.ok(ADAPTER);
  assert.equal(ADAPTER.adapterId, "alice_voice_bridge_v1");
  assert.equal(ADAPTER.version, "1.0.0");
});

test("builtin entry patterns load", () => {
  assert.ok(ENTRY_PATTERNS);
  assert.ok(ENTRY_PATTERNS.length >= 3);
});

test("builtin has RU entry patterns", () => {
  const ruPatterns = ENTRY_PATTERNS.filter((p) => p.languageCode === "ru");
  assert.ok(ruPatterns.length >= 3);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin adapter validates with no errors", () => {
  const errors = validateAliceBridgeAdapter(ADAPTER);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

test("entry patterns validate with no errors", () => {
  const errors = validateEntryPatterns(ENTRY_PATTERNS);
  assert.equal(errors.length, 0, `Entry pattern errors: ${JSON.stringify(errors)}`);
});

// ── Normalization ──
console.log("\nNormalization:");

test("normalizeAliceRequest normalizes input", () => {
  const request: AliceVoiceRequest = {
    requestId: "req-1",
    inputText: "Привет, как дела?",
    locale: "ru-RU",
  };
  const normalized = normalizeAliceRequest(request, ENTRY_PATTERNS);
  assert.equal(normalized.requestId, "req-1");
  assert.equal(normalized.sourceSurface, "alice");
  assert.equal(normalized.text, "Привет, как дела?");
  assert.equal(normalized.languageCode, "ru");
  assert.equal(normalized.entryIntent, "plain_voice_turn");
  assert.equal(normalized.personaId, "arisha");
  assert.equal(normalized.valid, true);
});

test("normalizeAliceRequest detects arisha entry", () => {
  const request: AliceVoiceRequest = {
    requestId: "req-2",
    inputText: "алиса позови аришу",
    locale: "ru-RU",
  };
  const normalized = normalizeAliceRequest(request, ENTRY_PATTERNS);
  assert.equal(normalized.entryIntent, "arisha_entry");
});

test("normalizeAliceRequest handles empty input", () => {
  const request: AliceVoiceRequest = {
    requestId: "req-3",
    inputText: "",
  };
  const normalized = normalizeAliceRequest(request, ENTRY_PATTERNS);
  assert.equal(normalized.valid, false);
  assert.ok(normalized.validationErrors);
});

test("detectAliceLanguage detects ru locale", () => {
  assert.equal(detectAliceLanguage({ requestId: "r" }, "ru-RU"), "ru");
  assert.equal(detectAliceLanguage({ requestId: "r" }, "en-US"), "en");
  assert.equal(detectAliceLanguage({ requestId: "r" }, "uz-UZ"), "uz");
});

test("detectAliceLanguage defaults to ru", () => {
  assert.equal(detectAliceLanguage({ requestId: "r" }, "unknown"), "ru");
});

test("detectArishaEntryIntent detects entry pattern", () => {
  assert.equal(detectArishaEntryIntent("алиса позови аришу", ENTRY_PATTERNS), "arisha_entry");
  assert.equal(detectArishaEntryIntent("алиса включи аришу", ENTRY_PATTERNS), "arisha_entry");
  assert.equal(detectArishaEntryIntent("алиса переключи на аришу", ENTRY_PATTERNS), "arisha_entry");
});

test("detectArishaEntryIntent returns plain_voice_turn for normal text", () => {
  assert.equal(detectArishaEntryIntent("привет как дела", ENTRY_PATTERNS), "plain_voice_turn");
});

test("detectArishaEntryIntent returns unknown for empty text", () => {
  assert.equal(detectArishaEntryIntent("", ENTRY_PATTERNS), "unknown");
});

test("isValidNormalizedInput returns true for valid input", () => {
  const normalized = normalizeAliceRequest({ requestId: "r", inputText: "hello" }, ENTRY_PATTERNS);
  assert.equal(isValidNormalizedInput(normalized), true);
});

test("isValidNormalizedInput returns false for invalid input", () => {
  const normalized = normalizeAliceRequest({ requestId: "r", inputText: "" }, ENTRY_PATTERNS);
  assert.equal(isValidNormalizedInput(normalized), false);
});

// ── Session Binding ──
console.log("\nSession binding:");

test("openAliceBridgeSession creates active session", () => {
  const session = openAliceBridgeSession({
    arishaEntryDetected: true,
    languageCode: "ru",
  });
  assert.equal(session.surface, "alice");
  assert.equal(session.personaId, "arisha");
  assert.equal(session.active, true);
  assert.equal(session.arishaEntryDetected, true);
  assert.ok(session.bridgeSessionId);
});

test("bindRuntimeSession binds runtime session", () => {
  const session = openAliceBridgeSession({ arishaEntryDetected: false });
  const bound = bindRuntimeSession(session, "runtime-123");
  assert.equal(bound.runtimeSessionId, "runtime-123");
});

test("isSessionActive returns true for active session", () => {
  const session = openAliceBridgeSession({ arishaEntryDetected: true });
  assert.equal(isSessionActive(session), true);
});

test("deactivateSession deactivates session", () => {
  const session = openAliceBridgeSession({ arishaEntryDetected: true });
  const deactivated = deactivateSession(session);
  assert.equal(deactivated.active, false);
});

// ── Delivery ──
console.log("\nDelivery:");

test("buildDeliveredResponse creates delivered response", () => {
  const response = buildDeliveredResponse({
    requestId: "req-1",
    responseText: "Hello!",
    truthSummary: "Delivered via Alice",
  });
  assert.equal(response.outcome, "delivered");
  assert.equal(response.responseText, "Hello!");
  assert.equal(response.shouldCloseSession, false);
});

test("buildAckResponse creates acknowledged response", () => {
  const response = buildAckResponse({
    requestId: "req-1",
    responseText: "Got it.",
  });
  assert.equal(response.outcome, "acknowledged");
});

test("buildForwardedResponse creates forwarded response", () => {
  const response = buildForwardedResponse({
    requestId: "req-1",
    truthSummary: "Forwarded to runtime",
  });
  assert.equal(response.outcome, "forwarded");
  assert.equal(response.responseText, undefined);
});

test("buildOpenedResponse creates opened response", () => {
  const response = buildOpenedResponse({
    requestId: "req-1",
  });
  assert.equal(response.outcome, "opened");
});

test("requiresResponseText returns true for delivered", () => {
  assert.equal(requiresResponseText("delivered"), true);
  assert.equal(requiresResponseText("acknowledged"), true);
  assert.equal(requiresResponseText("fallback_delivered"), true);
  assert.equal(requiresResponseText("forwarded"), false);
});

// ── Fallback ──
console.log("\nFallback:");

test("buildFallbackResponse creates fallback response", () => {
  const response = buildFallbackResponse({
    requestId: "req-1",
    fallbackTarget: { surface: "text", reason: "Voice unavailable" },
    responseText: "Fallback text",
  });
  assert.equal(response.outcome, "fallback_delivered");
  assert.ok(response.notes);
});

test("canFallbackFromAlice allows valid surfaces", () => {
  assert.equal(canFallbackFromAlice({ surface: "web_voice", reason: "test" }), true);
  assert.equal(canFallbackFromAlice({ surface: "telegram_voice", reason: "test" }), true);
  assert.equal(canFallbackFromAlice({ surface: "tgm_voice", reason: "test" }), true);
  assert.equal(canFallbackFromAlice({ surface: "text", reason: "test" }), true);
});

// ── Interruptions ──
console.log("\nInterruptions:");

test("buildInterruptedResponse creates blocked response", () => {
  const response = buildInterruptedResponse({
    requestId: "req-1",
    reason: "Bridge dropped",
  });
  assert.equal(response.outcome, "blocked");
  assert.equal(response.shouldCloseSession, true);
});

test("buildFailedResponse creates failed response", () => {
  const response = buildFailedResponse({
    requestId: "req-1",
    reason: "Runtime error",
  });
  assert.equal(response.outcome, "failed");
  assert.equal(response.shouldCloseSession, true);
});

// ── Truth ──
console.log("\nTruth:");

test("assertAliceTransportTruth passes for valid delivered response", () => {
  const response = buildDeliveredResponse({
    requestId: "req-1",
    responseText: "Hello!",
  });
  assert.equal(assertAliceTransportTruth(response), null);
});

test("assertAliceTransportTruth fails for delivered without text", () => {
  const response = buildDeliveredResponse({
    requestId: "req-1",
    responseText: "",
  });
  assert.ok(assertAliceTransportTruth(response));
});

test("assertAliceTransportTruth fails for forwarded with text", () => {
  const response = buildForwardedResponse({
    requestId: "req-1",
  });
  (response as any).responseText = "should not be here";
  assert.ok(assertAliceTransportTruth(response));
});

test("assertAliceTransportTruth fails for blocked without close session", () => {
  const response = buildInterruptedResponse({ requestId: "req-1" });
  response.shouldCloseSession = false;
  assert.ok(assertAliceTransportTruth(response));
});

test("buildTruthSummary returns descriptive strings", () => {
  assert.ok(buildTruthSummary("delivered", "bridge-1", "runtime-1").length > 0);
  assert.ok(buildTruthSummary("forwarded").length > 0);
  assert.ok(buildTruthSummary("failed").length > 0);
});

test("isDeliveredDistinctFromExecuted returns true for delivered", () => {
  assert.equal(isDeliveredDistinctFromExecuted("delivered"), true);
  assert.equal(isDeliveredDistinctFromExecuted("forwarded"), false);
});

test("isOutcomeTerminal returns true for blocked/failed", () => {
  assert.equal(isOutcomeTerminal("blocked"), true);
  assert.equal(isOutcomeTerminal("failed"), true);
  assert.equal(isOutcomeTerminal("delivered"), false);
});

// ── Main Handler ──
console.log("\nMain handler:");

test("handleAliceVoiceRequest handles valid arisha entry", () => {
  const request: AliceVoiceRequest = {
    requestId: "req-1",
    inputText: "алиса позови аришу",
    locale: "ru-RU",
  };
  const response = handleAliceVoiceRequest(request, {
    simulatedRuntimeOutcome: "delivered",
    simulatedRuntimeText: "Привет! Я Ариша.",
  }, ENTRY_PATTERNS);
  assert.equal(response.outcome, "delivered");
  assert.equal(response.responseText, "Привет! Я Ариша.");
});

test("handleAliceVoiceRequest handles forwarded outcome", () => {
  const request: AliceVoiceRequest = {
    requestId: "req-2",
    inputText: "привет",
  };
  const response = handleAliceVoiceRequest(request, {
    simulatedRuntimeOutcome: "forwarded",
  }, ENTRY_PATTERNS);
  assert.equal(response.outcome, "forwarded");
});

test("handleAliceVoiceRequest handles blocked outcome", () => {
  const request: AliceVoiceRequest = {
    requestId: "req-3",
    inputText: "алиса позови аришу",
  };
  const response = handleAliceVoiceRequest(request, {
    simulatedRuntimeOutcome: "blocked",
  }, ENTRY_PATTERNS);
  assert.equal(response.outcome, "blocked");
  assert.equal(response.shouldCloseSession, true);
});

test("handleAliceVoiceRequest handles failed outcome", () => {
  const request: AliceVoiceRequest = {
    requestId: "req-4",
    inputText: "алиса позови аришу",
  };
  const response = handleAliceVoiceRequest(request, {
    simulatedRuntimeOutcome: "failed",
  }, ENTRY_PATTERNS);
  assert.equal(response.outcome, "failed");
  assert.equal(response.shouldCloseSession, true);
});

test("handleAliceVoiceRequest handles fallback outcome", () => {
  const request: AliceVoiceRequest = {
    requestId: "req-5",
    inputText: "алиса позови аришу",
  };
  const response = handleAliceVoiceRequest(request, {
    simulatedRuntimeOutcome: "fallback",
    simulatedRuntimeText: "Fallback text",
  }, ENTRY_PATTERNS);
  assert.equal(response.outcome, "fallback_delivered");
});

test("handleAliceVoiceRequest rejects empty input", () => {
  const request: AliceVoiceRequest = {
    requestId: "req-6",
    inputText: "",
  };
  const response = handleAliceVoiceRequest(request, undefined, ENTRY_PATTERNS);
  assert.equal(response.outcome, "failed");
});

// ── Selectors ──
console.log("\nSelectors:");

test("getAliceBridgeAdapter returns adapter", () => {
  const adapter = getAliceBridgeAdapter();
  assert.ok(adapter);
  assert.equal(adapter!.adapterId, "alice_voice_bridge_v1");
});

test("supportsArishaEntryDetection returns true", () => {
  assert.equal(supportsArishaEntryDetection(), true);
});

test("supportsSessionBinding returns true", () => {
  assert.equal(supportsSessionBinding(), true);
});

test("supportsTransportTruth returns true", () => {
  assert.equal(supportsTransportTruth(), true);
});

test("supportsFallbackToTextSurface returns true", () => {
  assert.equal(supportsFallbackToTextSurface(), true);
});

test("getSupportedEntryPatterns returns RU patterns", () => {
  const patterns = getSupportedEntryPatterns("ru");
  assert.ok(patterns.length >= 3);
});

test("getSupportedEntryPatterns returns empty for en (placeholders only)", () => {
  const patterns = getSupportedEntryPatterns("en");
  assert.ok(patterns.length >= 1);
});

test("getAdapterVersion returns 1.0.0", () => {
  assert.equal(getAdapterVersion(), "1.0.0");
});

test("getAdapterId returns alice_voice_bridge_v1", () => {
  assert.equal(getAdapterId(), "alice_voice_bridge_v1");
});

// ── Response Validation ──
console.log("\nResponse validation:");

test("validateAliceBridgeResponse passes for valid delivered response", () => {
  const response = buildDeliveredResponse({
    requestId: "req-1",
    responseText: "Hello!",
  });
  const errors = validateAliceBridgeResponse(response);
  assert.equal(errors.length, 0);
});

test("validateAliceBridgeResponse fails for missing requestId", () => {
  const response = buildDeliveredResponse({
    requestId: "",
    responseText: "Hello!",
  });
  const errors = validateAliceBridgeResponse(response);
  assert.ok(errors.length > 0);
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no delivery without valid normalized input", () => {
  const response = handleAliceVoiceRequest({
    requestId: "req-san-1",
    inputText: "",
  }, { simulatedRuntimeOutcome: "delivered", simulatedRuntimeText: "test" }, ENTRY_PATTERNS);
  assert.equal(response.outcome, "failed");
});

test("no session without binding (binding is optional in v1)", () => {
  const session = openAliceBridgeSession({ arishaEntryDetected: true });
  assert.ok(session.bridgeSessionId);
  assert.equal(session.runtimeSessionId, undefined); // not yet bound
});

test("no fake delivered from forwarded", () => {
  const response = buildForwardedResponse({ requestId: "req-san-2" });
  assert.equal(response.outcome, "forwarded");
  assert.notEqual(response.outcome, "delivered");
});

test("no fallback masquerading as normal delivery", () => {
  const response = buildFallbackResponse({
    requestId: "req-san-3",
    fallbackTarget: { surface: "text", reason: "Voice unavailable" },
  });
  assert.equal(response.outcome, "fallback_delivered");
  assert.notEqual(response.outcome, "delivered");
});

test("no missing RU entry patterns", () => {
  const ruPatterns = ENTRY_PATTERNS.filter((p) => p.languageCode === "ru");
  assert.ok(ruPatterns.length >= 3);
  assert.ok(ruPatterns.some((p) => p.pattern.includes("аришу")));
});

test("transport truth preserved in handler responses", () => {
  const request: AliceVoiceRequest = {
    requestId: "req-san-4",
    inputText: "алиса позови аришу",
  };
  const response = handleAliceVoiceRequest(request, {
    simulatedRuntimeOutcome: "delivered",
    simulatedRuntimeText: "Test response",
  }, ENTRY_PATTERNS);
  const truthError = assertAliceTransportTruth(response);
  assert.equal(truthError, null, `Transport truth violation: ${truthError}`);
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
