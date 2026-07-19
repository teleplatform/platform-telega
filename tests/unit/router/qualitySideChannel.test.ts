/**
 * TGP-18A — Router Quality Side-Channel Integration Tests
 *
 * Verifies:
 * - Quality evaluation runs after successful routing without breaking results
 * - Quality evaluation runs on failed routing without breaking fallback
 * - Quality side-channel is purely observational — does not affect provider selection
 * - Quality registry accumulates signals from router execution
 * - normalizeTaskType maps router meta.task.type correctly
 */

import assert from "node:assert/strict";
import {
  normalizeTaskType,
  evaluateProviderQuality,
  getQualitySnapshot,
  resetQualityRegistry,
  listQualitySnapshots,
} from "../../../src/core/provider-quality-runtime.js";
import {
  resetAll,
  recordSuccess,
} from "../../../src/core/provider-health-runtime.js";
import {
  resetScoringConfig,
  resetProviderPolicies,
  selectBestProvider,
} from "../../../src/core/provider-scoring-engine.js";
import {
  selectProvider,
  parseRouteIntent,
} from "../../../src/core/provider-selection-orchestrator.js";

let passed = 0;
let failed = 0;
const seq: (() => Promise<void>)[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  seq.push(async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
    }
  });
}

console.log("\nTGP-18A — Router Quality Side-Channel:\n");

// ─── normalizeTaskType ───────────────────────────────────────────────────────

test("normalizeTaskType maps 'chat' → chat", () => {
  assert.equal(normalizeTaskType("chat"), "chat");
});

test("normalizeTaskType maps 'conversation' → chat", () => {
  assert.equal(normalizeTaskType("conversation"), "chat");
});

test("normalizeTaskType maps 'deep_reasoning' → reasoning", () => {
  assert.equal(normalizeTaskType("deep_reasoning"), "reasoning");
});

test("normalizeTaskType maps 'code_generation' → code", () => {
  assert.equal(normalizeTaskType("code_generation"), "code");
});

test("normalizeTaskType maps 'image_analysis' → vision", () => {
  assert.equal(normalizeTaskType("image_analysis"), "vision");
});

test("normalizeTaskType maps 'tool_use' → function_calling", () => {
  assert.equal(normalizeTaskType("tool_use"), "function_calling");
});

test("normalizeTaskType maps 'json_schema' → structured_output", () => {
  assert.equal(normalizeTaskType("json_schema"), "structured_output");
});

test("normalizeTaskType maps 'long_context_window' → long_context", () => {
  assert.equal(normalizeTaskType("long_context_window"), "long_context");
});

test("normalizeTaskType maps unknown → generic", () => {
  assert.equal(normalizeTaskType("something_weird"), "generic");
});

test("normalizeTaskType maps empty string → chat", () => {
  assert.equal(normalizeTaskType(""), "chat");
});

// ─── Quality evaluation records to registry ──────────────────────────────────

test("evaluateProviderQuality records execution_success signal to registry", async () => {
  resetQualityRegistry();
  const signals = await evaluateProviderQuality({
    providerId: "kimi_api",
    modelId: "kimi-k3",
    taskType: "chat",
    requestId: "qsc-1",
    executionOk: true,
    retryCount: 0,
    fallbackUsed: false,
    taskCompleted: true,
    completionQuality: "full",
    latencyMs: 500,
    timestamp: Date.now(),
  });
  assert.ok(signals.length > 0, "Should produce at least one signal");
  const snap = getQualitySnapshot("kimi_api", "chat", "kimi-k3");
  assert.ok(snap, "Should have snapshot in registry");
  assert.ok(snap.totalSamples >= 1, "Should have at least 1 sample");
  assert.equal(snap.providerId, "kimi_api");
});

test("evaluateProviderQuality records execution_failure + task_failed on error", async () => {
  resetQualityRegistry();
  const signals = await evaluateProviderQuality({
    providerId: "zyloo_api",
    taskType: "code",
    requestId: "qsc-2",
    executionOk: false,
    failureType: "auth",
    retryCount: 0,
    fallbackUsed: false,
    taskCompleted: false,
    completionQuality: "none",
    latencyMs: 200,
    timestamp: Date.now(),
  });
  const types = signals.map(s => s.signalType);
  assert.ok(types.includes("execution_failure"), "Should emit execution_failure");
  assert.ok(types.includes("task_failed"), "Should emit task_failed");
  const snap = getQualitySnapshot("zyloo_api", "code");
  assert.ok(snap, "Should have snapshot");
  assert.equal(snap.totalSamples, 2);
});

test("evaluateProviderQuality emits retry_required when retryCount > 0", async () => {
  resetQualityRegistry();
  const signals = await evaluateProviderQuality({
    providerId: "kimi_api",
    taskType: "reasoning",
    requestId: "qsc-3",
    executionOk: true,
    retryCount: 2,
    fallbackUsed: false,
    taskCompleted: true,
    completionQuality: "full",
    latencyMs: 800,
    timestamp: Date.now(),
  });
  const types = signals.map(s => s.signalType);
  assert.ok(types.includes("retry_required"), "Should emit retry_required");
  assert.ok(types.includes("execution_success"), "Should emit execution_success");
});

test("evaluateProviderQuality emits fallback_required when fallbackUsed", async () => {
  resetQualityRegistry();
  const signals = await evaluateProviderQuality({
    providerId: "kimi_api",
    taskType: "chat",
    requestId: "qsc-4",
    executionOk: true,
    retryCount: 0,
    fallbackUsed: true,
    taskCompleted: true,
    completionQuality: "partial",
    latencyMs: 1200,
    timestamp: Date.now(),
  });
  const types = signals.map(s => s.signalType);
  assert.ok(types.includes("fallback_required"), "Should emit fallback_required");
});

test("evaluateProviderQuality handles schema_valid signal", async () => {
  resetQualityRegistry();
  const signals = await evaluateProviderQuality({
    providerId: "kimi_api",
    taskType: "structured_output",
    requestId: "qsc-5",
    executionOk: true,
    retryCount: 0,
    fallbackUsed: false,
    schemaValid: true,
    taskCompleted: true,
    completionQuality: "full",
    latencyMs: 600,
    timestamp: Date.now(),
  });
  const types = signals.map(s => s.signalType);
  assert.ok(types.includes("schema_valid"), "Should emit schema_valid");
});

test("evaluateProviderQuality handles schema_invalid signal", async () => {
  resetQualityRegistry();
  const signals = await evaluateProviderQuality({
    providerId: "kimi_api",
    taskType: "structured_output",
    requestId: "qsc-6",
    executionOk: true,
    retryCount: 0,
    fallbackUsed: false,
    schemaValid: false,
    schemaErrors: ["missing field: name"],
    taskCompleted: true,
    completionQuality: "partial",
    latencyMs: 700,
    timestamp: Date.now(),
  });
  const types = signals.map(s => s.signalType);
  assert.ok(types.includes("schema_invalid"), "Should emit schema_invalid");
});

test("evaluateProviderQuality handles tool call signals", async () => {
  resetQualityRegistry();
  const signals = await evaluateProviderQuality({
    providerId: "kimi_api",
    taskType: "function_calling",
    requestId: "qsc-7",
    executionOk: true,
    retryCount: 0,
    fallbackUsed: false,
    toolCallsAttempted: 3,
    toolCallsValid: 2,
    taskCompleted: true,
    completionQuality: "full",
    latencyMs: 900,
    timestamp: Date.now(),
  });
  const toolSignals = signals.filter(s => s.signalType.startsWith("tool_call_"));
  assert.equal(toolSignals.length, 3, "Should emit 3 tool call signals");
  const valid = toolSignals.filter(s => s.signalType === "tool_call_valid");
  const invalid = toolSignals.filter(s => s.signalType === "tool_call_invalid");
  assert.equal(valid.length, 2, "Should have 2 valid tool calls");
  assert.equal(invalid.length, 1, "Should have 1 invalid tool call");
});

// ─── Quality does NOT affect provider selection ─────────────────────────────

test("Quality side-channel is purely observational — selection plan unchanged", async () => {
  resetAll();
  resetScoringConfig();
  resetProviderPolicies();
  resetQualityRegistry();

  recordSuccess("kimi_api", 100, Date.now());
  recordSuccess("kimi_api", 110, Date.now());

  // Plan BEFORE quality
  const planBefore = selectProvider("kimi:kimi-k3", {
    requiredCapabilities: [],
    strict: false,
    noFallback: false,
  });

  // Accumulate quality signals — some negative
  await evaluateProviderQuality({
    providerId: "kimi_api",
    taskType: "chat",
    requestId: "qsc-8",
    executionOk: false,
    retryCount: 3,
    fallbackUsed: true,
    taskCompleted: false,
    completionQuality: "none",
    latencyMs: 5000,
    timestamp: Date.now(),
  });
  await evaluateProviderQuality({
    providerId: "kimi_api",
    taskType: "chat",
    requestId: "qsc-9",
    executionOk: false,
    retryCount: 2,
    fallbackUsed: true,
    taskCompleted: false,
    completionQuality: "none",
    latencyMs: 4500,
    timestamp: Date.now(),
  });

  // Plan AFTER quality — should be identical (quality is observational)
  const planAfter = selectProvider("kimi:kimi-k3", {
    requiredCapabilities: [],
    strict: false,
    noFallback: false,
  });

  assert.equal(planBefore.selectedProviderId, planAfter.selectedProviderId,
    "Quality signals must not change selected provider");
  assert.deepEqual(planBefore.fallbackOrder, planAfter.fallbackOrder,
    "Quality signals must not change fallback order");
  assert.equal(planBefore.mode, planAfter.mode,
    "Quality signals must not change mode");
});

test("Quality registry accumulates across multiple evaluations", async () => {
  resetQualityRegistry();

  for (let i = 0; i < 5; i++) {
    await evaluateProviderQuality({
      providerId: "kimi_api",
      taskType: "chat",
      requestId: `qsc-batch-${i}`,
      executionOk: true,
      retryCount: 0,
      fallbackUsed: false,
      taskCompleted: true,
      completionQuality: "full",
      latencyMs: 400 + i * 50,
      timestamp: Date.now(),
    });
  }

  const snap = getQualitySnapshot("kimi_api", "chat");
  assert.ok(snap, "Should have snapshot");
  assert.ok(snap.totalSamples >= 5, "Should have accumulated signals");
  assert.equal(snap.providerId, "kimi_api");
  assert.equal(snap.taskType, "chat");
});

test("Quality snapshots isolated by taskType", async () => {
  resetQualityRegistry();

  await evaluateProviderQuality({
    providerId: "kimi_api",
    taskType: "chat",
    requestId: "qsc-iso-1",
    executionOk: true,
    retryCount: 0,
    fallbackUsed: false,
    taskCompleted: true,
    completionQuality: "full",
    latencyMs: 300,
    timestamp: Date.now(),
  });

  await evaluateProviderQuality({
    providerId: "kimi_api",
    taskType: "code",
    requestId: "qsc-iso-2",
    executionOk: true,
    retryCount: 0,
    fallbackUsed: false,
    taskCompleted: true,
    completionQuality: "full",
    latencyMs: 500,
    timestamp: Date.now(),
  });

  const chatSnap = getQualitySnapshot("kimi_api", "chat");
  const codeSnap = getQualitySnapshot("kimi_api", "code");
  assert.ok(chatSnap, "chat snapshot should exist");
  assert.ok(codeSnap, "code snapshot should exist");
  assert.ok(chatSnap.totalSamples >= 1, "chat should have at least 1 sample");
  assert.ok(codeSnap.totalSamples >= 1, "code should have at least 1 sample");
  assert.ok(chatSnap !== codeSnap, "Snapshots should be distinct objects");

  const allSnaps = listQualitySnapshots();
  const kimiSnaps = allSnaps.filter(s => s.providerId === "kimi_api");
  assert.ok(kimiSnaps.length >= 2, "Should have separate snapshots per taskType");
});

// ─── Execution ────────────────────────────────────────────────────────────────

(async () => {
  for (const fn of seq) await fn();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
