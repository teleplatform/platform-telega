// Voice Transport Orchestration Contract v1.0 — Unit Tests
// Run with: npx tsx tests/unit/voice-transport/voice-transport-orchestration-contract.test.ts

import assert from "node:assert/strict";
import { voiceTransportContract } from "../../../src/voice-transport/builtin.js";
import { validateTransportContract } from "../../../src/voice-transport/validators.js";
import {
  getVoiceTransportContract,
  supportsHandoff,
  supportsFallback,
  supportsTransportInterruption,
  getMaxFallbackAttempts,
  getMaxTransportRetries,
  getSupportedVoiceTransportSurfaces,
  requiresSessionBinding,
  getContractVersion,
} from "../../../src/voice-transport/selectors.js";
import {
  ENTRY_EVENT_SEQUENCE,
  ACK_EVENT_SEQUENCE,
  MAIN_TURN_SEQUENCE,
  HANDOFF_SEQUENCE,
  FALLBACK_SEQUENCE,
  CLOSE_SEQUENCE,
} from "../../../src/voice-transport/contracts.js";
import {
  createSessionBinding,
  recordEntryEvent,
  validateEntrySequence,
  isActiveBinding,
  deactivateBinding,
} from "../../../src/voice-transport/entry.js";
import {
  dispatchTurn,
  confirmDelivery,
  isDelivered,
  isDispatched,
  requireDispatchBeforeDelivery,
} from "../../../src/voice-transport/delivery.js";
import {
  startHandoff,
  completeHandoff,
  isHandoffComplete,
  getHandoffOutcome,
} from "../../../src/voice-transport/handoff.js";
import {
  recordTransportInterruption,
  isTransportInterruption,
  isInterruptedOutcome,
} from "../../../src/voice-transport/interruptions.js";
import {
  startFallback,
  completeFallback,
  isFallbackDelivered,
  canRetryFallback,
} from "../../../src/voice-transport/fallback.js";
import {
  classifyOutcomeFromEvent,
  isDeliveredOutcome,
  isTerminalOutcome,
  isInterruptOutcome,
  isTransferOutcome,
  buildDeliverySummary,
  DELIVERABLE_OUTCOMES,
  TERMINAL_OUTCOMES,
  INTERRUPT_OUTCOMES,
  TRANSFER_OUTCOMES,
} from "../../../src/voice-transport/outcomes.js";
import {
  isTransportOutcomeMasqueradingAsRuntimeSuccess,
  assertDeliveryTruthMatchesOutcome,
  buildTransportTruthSummary,
  isDeliveredDistinctFromExecuted,
} from "../../../src/voice-transport/truth.js";
import type { VoiceTransportSurface, VoiceTransportEvent, VoiceTransportOutcome } from "../../../src/voice-transport/types.js";

// Auto-registered via builtin import
const CONTRACT = voiceTransportContract;

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

test("builtin contract loads", () => {
  assert.ok(CONTRACT);
  assert.equal(CONTRACT.version, "1.0.0");
});

test("builtin contract has surfaces", () => {
  assert.ok(CONTRACT.supportedSurfaces.length >= 5);
});

test("builtin contract has events", () => {
  assert.ok(CONTRACT.supportedEvents.length >= 16);
});

test("builtin contract has outcomes", () => {
  assert.ok(CONTRACT.supportedOutcomes.length >= 11);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin contract validates with no errors", () => {
  const errors = validateTransportContract(CONTRACT);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

// ── Surfaces ──
console.log("\nSurfaces:");

const REQUIRED_SURFACES: VoiceTransportSurface[] = [
  "alice",
  "telegram_voice",
  "web_voice",
  "tgm_voice",
  "external_voice_bridge",
];

test("all required surfaces present", () => {
  for (const surface of REQUIRED_SURFACES) {
    assert.ok(CONTRACT.supportedSurfaces.includes(surface), `Missing surface: ${surface}`);
  }
});

// ── Events ──
console.log("\nEvents:");

const REQUIRED_EVENTS: VoiceTransportEvent[] = [
  "session_open_requested",
  "session_opened",
  "user_input_received",
  "input_forwarded_to_runtime",
  "runtime_ack_requested",
  "runtime_turn_requested",
  "system_turn_dispatched",
  "system_turn_delivered",
  "transport_interrupted",
  "transport_handoff_started",
  "transport_handoff_completed",
  "transport_fallback_started",
  "transport_fallback_completed",
  "session_close_requested",
  "session_closed",
  "transport_failed",
];

test("all required events present", () => {
  for (const event of REQUIRED_EVENTS) {
    assert.ok(CONTRACT.supportedEvents.includes(event), `Missing event: ${event}`);
  }
});

// ── Outcomes ──
console.log("\nOutcomes:");

const REQUIRED_OUTCOMES: VoiceTransportOutcome[] = [
  "opened",
  "received",
  "forwarded",
  "acknowledged",
  "dispatched",
  "delivered",
  "interrupted",
  "transferred",
  "fallback_delivered",
  "closed",
  "failed",
];

test("all required outcomes present", () => {
  for (const outcome of REQUIRED_OUTCOMES) {
    assert.ok(CONTRACT.supportedOutcomes.includes(outcome), `Missing outcome: ${outcome}`);
  }
});

// ── Session Binding ──
console.log("\nSession binding:");

test("createSessionBinding creates active binding", () => {
  const binding = createSessionBinding({
    surface: "alice",
    userId: "user-1",
    languageCode: "ru",
  });
  assert.equal(binding.surface, "alice");
  assert.equal(binding.personaId, "arisha");
  assert.equal(binding.active, true);
  assert.ok(binding.sessionId);
});

test("isActiveBinding returns true for active binding", () => {
  const binding = createSessionBinding({ surface: "alice" });
  assert.equal(isActiveBinding(binding), true);
});

test("deactivateBinding deactivates binding", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const deactivated = deactivateBinding(binding);
  assert.equal(deactivated.active, false);
});

// ── Entry Flow ──
console.log("\nEntry flow:");

test("validateEntrySequence accepts valid sequence", () => {
  assert.equal(validateEntrySequence(ENTRY_EVENT_SEQUENCE), true);
});

test("validateEntrySequence rejects incomplete sequence", () => {
  assert.equal(validateEntrySequence(["session_open_requested"]), false);
});

test("recordEntryEvent updates binding", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const updated = recordEntryEvent(binding, "session_opened");
  assert.ok(updated.updatedAt >= binding.createdAt);
});

// ── Delivery Flow ──
console.log("\nDelivery flow:");

test("dispatchTurn sets dispatched=true, delivered=false", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const state = dispatchTurn(binding);
  assert.equal(state.dispatched, true);
  assert.equal(state.delivered, false);
});

test("confirmDelivery sets delivered=true when dispatched", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const dispatched = dispatchTurn(binding);
  const delivered = confirmDelivery(dispatched);
  assert.equal(isDelivered(delivered), true);
});

test("confirmDelivery does not deliver without dispatch", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const state: ReturnType<typeof dispatchTurn> = {
    binding,
    dispatched: false,
    delivered: false,
  };
  const result = confirmDelivery(state);
  assert.equal(result.delivered, false);
});

test("isDispatched returns true for dispatched state", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const state = dispatchTurn(binding);
  assert.equal(isDispatched(state), true);
});

test("requireDispatchBeforeDelivery enforces dispatch-first", () => {
  assert.equal(requireDispatchBeforeDelivery(true), true);
  assert.equal(requireDispatchBeforeDelivery(false), false);
});

// ── Handoff Flow ──
console.log("\nHandoff flow:");

test("startHandoff initializes handoff state", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const state = startHandoff(binding, "web_voice");
  assert.equal(state.started, true);
  assert.equal(state.completed, false);
  assert.equal(state.fromSurface, "alice");
  assert.equal(state.toSurface, "web_voice");
});

test("completeHandoff completes handoff", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const started = startHandoff(binding, "web_voice");
  const completed = completeHandoff(started);
  assert.equal(isHandoffComplete(completed), true);
  assert.equal(completed.binding.surface, "web_voice");
});

test("getHandoffOutcome returns transferred when complete", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const started = startHandoff(binding, "web_voice");
  const completed = completeHandoff(started);
  assert.equal(getHandoffOutcome(completed), "transferred");
});

test("getHandoffOutcome returns null when incomplete", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const started = startHandoff(binding, "web_voice");
  assert.equal(getHandoffOutcome(started), null);
});

test("cannot handoff to same surface", () => {
  const binding = createSessionBinding({ surface: "alice" });
  assert.throws(() => startHandoff(binding, "alice"));
});

test("cannot complete handoff without starting", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const fakeState = { started: false, completed: false, fromSurface: "alice" as VoiceTransportSurface, toSurface: "web_voice" as VoiceTransportSurface, binding };
  assert.throws(() => completeHandoff(fakeState as any));
});

// ── Interruption Flow ──
console.log("\nInterruption flow:");

test("recordTransportInterruption creates interruption state", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const state = recordTransportInterruption(binding, "bridge dropped");
  assert.equal(state.interrupted, true);
  assert.equal(state.outcome, "interrupted");
});

test("isTransportInterruption returns true for interruption", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const state = recordTransportInterruption(binding);
  assert.equal(isTransportInterruption(state), true);
});

test("isInterruptedOutcome returns true for interrupted outcome", () => {
  assert.equal(isInterruptedOutcome("interrupted"), true);
  assert.equal(isInterruptedOutcome("delivered"), false);
});

// ── Fallback Flow ──
console.log("\nFallback flow:");

test("startFallback initializes fallback state", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const state = startFallback(binding);
  assert.equal(state.started, true);
  assert.equal(state.completed, false);
  assert.equal(state.attemptCount, 1);
});

test("completeFallback with success returns fallback_delivered", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const started = startFallback(binding);
  const completed = completeFallback(started, true);
  assert.equal(isFallbackDelivered(completed), true);
});

test("completeFallback with failure returns failed", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const started = startFallback(binding, 1);
  const completed = completeFallback(started, false);
  assert.equal(completed.outcome, "failed");
});

test("canRetryFallback returns false when attempts exhausted", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const started = startFallback(binding, 1);
  const failed = completeFallback(started, false);
  assert.equal(canRetryFallback(failed), false);
});

test("cannot complete fallback without starting", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const fakeState = { started: false, completed: false, attemptCount: 0, binding, outcome: "failed" as VoiceTransportOutcome, maxAttempts: 1 };
  assert.throws(() => completeFallback(fakeState as any));
});

// ── Outcome Classification ──
console.log("\nOutcome classification:");

test("classifyOutcomeFromEvent returns correct outcomes", () => {
  assert.equal(classifyOutcomeFromEvent("session_opened"), "opened");
  assert.equal(classifyOutcomeFromEvent("system_turn_delivered"), "delivered");
  assert.equal(classifyOutcomeFromEvent("transport_interrupted"), "interrupted");
  assert.equal(classifyOutcomeFromEvent("transport_handoff_completed"), "transferred");
  assert.equal(classifyOutcomeFromEvent("transport_fallback_completed"), "fallback_delivered");
  assert.equal(classifyOutcomeFromEvent("session_closed"), "closed");
  assert.equal(classifyOutcomeFromEvent("transport_failed"), "failed");
});

test("DELIVERABLE_OUTCOMES contains delivered and fallback_delivered", () => {
  assert.ok(DELIVERABLE_OUTCOMES.includes("delivered"));
  assert.ok(DELIVERABLE_OUTCOMES.includes("fallback_delivered"));
});

test("TERMINAL_OUTCOMES contains closed and failed", () => {
  assert.ok(TERMINAL_OUTCOMES.includes("closed"));
  assert.ok(TERMINAL_OUTCOMES.includes("failed"));
});

test("INTERRUPT_OUTCOMES contains interrupted", () => {
  assert.ok(INTERRUPT_OUTCOMES.includes("interrupted"));
});

test("TRANSFER_OUTCOMES contains transferred", () => {
  assert.ok(TRANSFER_OUTCOMES.includes("transferred"));
});

test("isDeliveredOutcome works correctly", () => {
  assert.equal(isDeliveredOutcome("delivered"), true);
  assert.equal(isDeliveredOutcome("fallback_delivered"), true);
  assert.equal(isDeliveredOutcome("dispatched"), false);
});

test("isTerminalOutcome works correctly", () => {
  assert.equal(isTerminalOutcome("closed"), true);
  assert.equal(isTerminalOutcome("failed"), true);
  assert.equal(isTerminalOutcome("delivered"), false);
});

test("buildDeliverySummary returns complete summary", () => {
  const summary = buildDeliverySummary("delivered", "alice", "test-session");
  assert.equal(summary.outcome, "delivered");
  assert.equal(summary.isDelivered, true);
});

// ── Truth Checks ──
console.log("\nTruth checks:");

test("delivered is distinct from executed", () => {
  assert.equal(isDeliveredDistinctFromExecuted("delivered"), true);
  assert.equal(isDeliveredDistinctFromExecuted("transferred"), false);
});

test("forwarded masquerading as runtime success is forbidden", () => {
  assert.equal(isTransportOutcomeMasqueradingAsRuntimeSuccess("forwarded", true), true);
});

test("assertDeliveryTruthMatchesOutcome validates event-outcome pairs", () => {
  assert.equal(assertDeliveryTruthMatchesOutcome("delivered", "system_turn_delivered"), true);
  assert.equal(assertDeliveryTruthMatchesOutcome("dispatched", "system_turn_dispatched"), true);
  assert.equal(assertDeliveryTruthMatchesOutcome("transferred", "transport_handoff_completed"), true);
  assert.equal(assertDeliveryTruthMatchesOutcome("interrupted", "transport_interrupted"), true);
  assert.equal(assertDeliveryTruthMatchesOutcome("fallback_delivered", "transport_fallback_completed"), true);
});

test("assertDeliveryTruthMatchesOutcome rejects mismatched pairs", () => {
  assert.equal(assertDeliveryTruthMatchesOutcome("delivered", "session_opened"), false);
  assert.equal(assertDeliveryTruthMatchesOutcome("dispatched", "transport_failed"), false);
});

test("buildTransportTruthSummary returns descriptive strings", () => {
  assert.ok(buildTransportTruthSummary("delivered", "alice").length > 0);
  assert.ok(buildTransportTruthSummary("interrupted", "alice").length > 0);
  assert.ok(buildTransportTruthSummary("failed", "alice").length > 0);
});

// ── Selectors ──
console.log("\nSelectors:");

test("getVoiceTransportContract returns contract", () => {
  const c = getVoiceTransportContract();
  assert.ok(c);
  assert.equal(c!.version, "1.0.0");
});

test("supportsHandoff returns true", () => {
  assert.equal(supportsHandoff(), true);
});

test("supportsFallback returns true", () => {
  assert.equal(supportsFallback(), true);
});

test("supportsTransportInterruption returns true", () => {
  assert.equal(supportsTransportInterruption(), true);
});

test("getMaxFallbackAttempts returns 1", () => {
  assert.equal(getMaxFallbackAttempts(), 1);
});

test("getMaxTransportRetries returns 2", () => {
  assert.equal(getMaxTransportRetries(), 2);
});

test("getSupportedVoiceTransportSurfaces returns 5 surfaces", () => {
  const surfaces = getSupportedVoiceTransportSurfaces();
  assert.ok(surfaces);
  assert.equal(surfaces!.length, 5);
});

test("requiresSessionBinding returns true", () => {
  assert.equal(requiresSessionBinding(), true);
});

test("getContractVersion returns 1.0.0", () => {
  assert.equal(getContractVersion(), "1.0.0");
});

// ── Limits ──
console.log("\nLimits:");

test("maxFallbackAttempts <= 1", () => {
  assert.ok(CONTRACT.maxFallbackAttempts <= 1);
});

test("maxTransportRetries <= 2", () => {
  assert.ok(CONTRACT.maxTransportRetries <= 2);
});

test("requiresSessionBinding === true", () => {
  assert.equal(CONTRACT.requiresSessionBinding, true);
});

test("supportsHandoff === true", () => {
  assert.equal(CONTRACT.supportsHandoff, true);
});

test("supportsFallback === true", () => {
  assert.equal(CONTRACT.supportsFallback, true);
});

test("supportsTransportInterruption === true", () => {
  assert.equal(CONTRACT.supportsTransportInterruption, true);
});

// ── Event Sequences ──
console.log("\nEvent sequences:");

test("ENTRY_EVENT_SEQUENCE has 4 events", () => {
  assert.equal(ENTRY_EVENT_SEQUENCE.length, 4);
});

test("ACK_EVENT_SEQUENCE has 3 events", () => {
  assert.equal(ACK_EVENT_SEQUENCE.length, 3);
});

test("MAIN_TURN_SEQUENCE has 3 events", () => {
  assert.equal(MAIN_TURN_SEQUENCE.length, 3);
});

test("HANDOFF_SEQUENCE has 2 events", () => {
  assert.equal(HANDOFF_SEQUENCE.length, 2);
});

test("FALLBACK_SEQUENCE has 2 events", () => {
  assert.equal(FALLBACK_SEQUENCE.length, 2);
});

test("CLOSE_SEQUENCE has 2 events", () => {
  assert.equal(CLOSE_SEQUENCE.length, 2);
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no delivered without dispatch (requireDispatchBeforeDelivery)", () => {
  assert.equal(requireDispatchBeforeDelivery(false), false);
});

test("no handoff without binding (throws on same surface)", () => {
  const binding = createSessionBinding({ surface: "alice" });
  assert.throws(() => startHandoff(binding, "alice"));
});

test("no fallback without start", () => {
  const binding = createSessionBinding({ surface: "alice" });
  const fakeState = { started: false, completed: false, attemptCount: 0, binding, outcome: "failed" as VoiceTransportOutcome, maxAttempts: 1 };
  assert.throws(() => completeFallback(fakeState as any));
});

test("transport success does not masquerade as runtime completion", () => {
  // Transport "delivered" is delivery-level truth, NOT runtime execution success
  const masquerading = isTransportOutcomeMasqueradingAsRuntimeSuccess("delivered", true);
  assert.equal(masquerading, false); // delivered ≠ executed
});

test("forwarded outcome should not be claimed as runtime success", () => {
  const masquerading = isTransportOutcomeMasqueradingAsRuntimeSuccess("forwarded", true);
  assert.equal(masquerading, true); // This IS forbidden
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
