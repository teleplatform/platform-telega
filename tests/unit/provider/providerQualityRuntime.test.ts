/**
 * TGP-18A — Provider Quality Runtime Tests
 */

import assert from "node:assert/strict";
import {
  recordQualitySignal,
  recordQualitySignals,
  getQualitySnapshot,
  listQualitySnapshots,
  resetQualityRegistry,
  getQualityConfig,
  evaluateProviderQuality,
  buildQualitySnapshot,
  createEmptyBucket,
  addSignalToBucket,
  normalizeTaskType,
  sanitizeQualitySnapshot,
  QUALITY_SIGNAL_TYPES,
  QUALITY_DIMENSIONS,
  DEFAULT_QUALITY_CONFIG,
  type ProviderQualitySignal,
  type ProviderQualitySnapshot,
  type ProviderQualityConfig,
  type RollingQualityBucket,
} from "../../../src/core/provider-quality-runtime.js";

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

function cleanup() {
  resetQualityRegistry();
}

console.log("\nTGP-18A — Provider Quality Runtime:\n");

// ─── Contracts ────────────────────────────────────────────────────────────────

test("QUALITY_SIGNAL_TYPES includes all expected types", () => {
  assert.ok(QUALITY_SIGNAL_TYPES.includes("execution_success"));
  assert.ok(QUALITY_SIGNAL_TYPES.includes("task_completed"));
  assert.ok(QUALITY_SIGNAL_TYPES.includes("schema_valid"));
  assert.ok(QUALITY_SIGNAL_TYPES.includes("tool_call_valid"));
});

test("QUALITY_DIMENSIONS includes all expected dimensions", () => {
  assert.ok(QUALITY_DIMENSIONS.includes("taskCompletion"));
  assert.ok(QUALITY_DIMENSIONS.includes("schemaCompliance"));
  assert.ok(QUALITY_DIMENSIONS.includes("toolCallValidity"));
  assert.ok(QUALITY_DIMENSIONS.includes("retryEfficiency"));
  assert.ok(QUALITY_DIMENSIONS.includes("fallbackAvoidance"));
  assert.ok(QUALITY_DIMENSIONS.includes("validatorScore"));
});

test("DEFAULT_QUALITY_CONFIG has valid weights summing to 1.0", () => {
  const weights = Object.values(DEFAULT_QUALITY_CONFIG.dimensionWeights);
  const sum = weights.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1.0) < 0.001, `weights sum to ${sum}`);
});

test("normalizeTaskType handles all task types", () => {
  assert.equal(normalizeTaskType("chat"), "chat");
  assert.equal(normalizeTaskType("reasoning"), "reasoning");
  assert.equal(normalizeTaskType("code"), "code");
  assert.equal(normalizeTaskType("vision"), "vision");
  assert.equal(normalizeTaskType("function_calling"), "function_calling");
  assert.equal(normalizeTaskType("structured_output"), "structured_output");
  assert.equal(normalizeTaskType("long_context"), "long_context");
  assert.equal(normalizeTaskType("unknown"), "generic");
  assert.equal(normalizeTaskType(""), "chat");
});

// ─── Rolling Bucket ────────────────────────────────────────────────────────────

test("createEmptyBucket initializes correctly", () => {
  const b = createEmptyBucket("openai_api", undefined, "chat");
  assert.equal(b.providerId, "openai_api");
  assert.equal(b.taskType, "chat");
  assert.equal(b.totalSamples, 0);
  assert.deepEqual(b.signals, []);
});

test("addSignalToBucket records signal and increments counts", () => {
  const b = createEmptyBucket("openai_api", undefined, "chat");
  const signal: ProviderQualitySignal = {
    signalType: "execution_success",
    providerId: "openai_api",
    taskType: "chat",
    requestId: "req-1",
    value: 1.0,
    weight: 1.0,
    timestamp: Date.now(),
  };
  addSignalToBucket(b, signal);
  assert.equal(b.totalSamples, 1);
  assert.equal(b.counts.execution_success, 1);
  // taskCompletion only calculated from task_* signals, not execution_*
  assert.ok(b.dimensionScores.taskCompletion === undefined || b.dimensionScores.taskCompletion === 0);
});

test("addSignalToBucket respects maxSamplesPerBucket (FIFO eviction)", () => {
  const config = { ...DEFAULT_QUALITY_CONFIG, maxSamplesPerBucket: 3 };
  const b = createEmptyBucket("openai_api", undefined, "chat");
  for (let i = 0; i < 5; i++) {
    addSignalToBucket(b, {
      signalType: "execution_success",
      providerId: "openai_api",
      taskType: "chat",
      requestId: `req-${i}`,
      value: 1.0,
      weight: 1.0,
      timestamp: Date.now() + i,
    }, config);
  }
  assert.equal(b.signals.length, 3);
  assert.equal(b.totalSamples, 5); // totalSamples never decrements
  // oldest evicted
  assert.ok(!b.signals.some(s => s.requestId === "req-0"));
});

test("addSignalToBucket recalculates dimension scores correctly", () => {
  const b = createEmptyBucket("openai_api", undefined, "chat");
  // 3 task_completed, 1 task_incomplete, 1 task_failed -> 3/5 = 0.6
  const signals: ProviderQualitySignal[] = [
    { signalType: "task_completed", providerId: "openai_api", taskType: "chat", requestId: "1", value: 1.0, weight: 1.0, timestamp: Date.now() },
    { signalType: "task_completed", providerId: "openai_api", taskType: "chat", requestId: "2", value: 1.0, weight: 1.0, timestamp: Date.now() },
    { signalType: "task_completed", providerId: "openai_api", taskType: "chat", requestId: "3", value: 1.0, weight: 1.0, timestamp: Date.now() },
    { signalType: "task_incomplete", providerId: "openai_api", taskType: "chat", requestId: "4", value: 0.0, weight: 1.0, timestamp: Date.now() },
    { signalType: "task_failed", providerId: "openai_api", taskType: "chat", requestId: "5", value: 0.0, weight: 1.0, timestamp: Date.now() },
  ];
  for (const s of signals) addSignalToBucket(b, s);
  assert.ok(Math.abs(b.dimensionScores.taskCompletion - 0.6) < 0.01);
});

// ─── Snapshot Building ────────────────────────────────────────────────────────

test("buildQualitySnapshot computes weighted score and confidence", () => {
  const b = createEmptyBucket("openai_api", undefined, "chat");
  // Add signals for all dimensions
  for (let i = 0; i < 10; i++) {
    addSignalToBucket(b, { signalType: "task_completed", providerId: "openai_api", taskType: "chat", requestId: `t${i}`, value: 1.0, weight: 1.0, timestamp: Date.now() });
    addSignalToBucket(b, { signalType: "schema_valid", providerId: "openai_api", taskType: "chat", requestId: `s${i}`, value: 1.0, weight: 1.0, timestamp: Date.now() });
    addSignalToBucket(b, { signalType: "tool_call_valid", providerId: "openai_api", taskType: "chat", requestId: `c${i}`, value: 1.0, weight: 1.0, timestamp: Date.now() });
    addSignalToBucket(b, { signalType: "execution_success", providerId: "openai_api", taskType: "chat", requestId: `e${i}`, value: 1.0, weight: 1.0, timestamp: Date.now() });
  }
  const snap = buildQualitySnapshot(b);
  assert.equal(snap.totalSamples, 40);
  assert.equal(snap.dimensionScores.taskCompletion, 1.0);
  assert.equal(snap.dimensionScores.schemaCompliance, 1.0);
  assert.equal(snap.dimensionScores.toolCallValidity, 1.0);
  assert.equal(snap.weightedScore, 1.0);
  assert.equal(snap.confidence, 1.0); // 40/20 = 2, capped at 1
  assert.equal(snap.providerId, "openai_api");
  assert.equal(snap.taskType, "chat");
});

test("buildQualitySnapshot confidence capped at 1.0", () => {
  const config = { ...DEFAULT_QUALITY_CONFIG, minimumSamplesForConfidence: 50 };
  const b = createEmptyBucket("openai_api", undefined, "chat");
  for (let i = 0; i < 100; i++) {
    addSignalToBucket(b, { signalType: "task_completed", providerId: "openai_api", taskType: "chat", requestId: `t${i}`, value: 1.0, weight: 1.0, timestamp: Date.now() }, config);
  }
  const snap = buildQualitySnapshot(b, config);
  assert.equal(snap.confidence, 1.0);
});

test("buildQualitySnapshot confidence below 1.0 for few samples", () => {
  const config = { ...DEFAULT_QUALITY_CONFIG, minimumSamplesForConfidence: 100 };
  const b = createEmptyBucket("openai_api", undefined, "chat");
  for (let i = 0; i < 10; i++) {
    addSignalToBucket(b, { signalType: "task_completed", providerId: "openai_api", taskType: "chat", requestId: `t${i}`, value: 1.0, weight: 1.0, timestamp: Date.now() }, config);
  }
  const snap = buildQualitySnapshot(b, config);
  assert.equal(snap.confidence, 0.1); // 10/100
});

// ─── Registry ─────────────────────────────────────────────────────────────────

test("recordQualitySignal creates bucket lazily", () => {
  cleanup();
  const s: ProviderQualitySignal = {
    signalType: "execution_success",
    providerId: "zyloo_api",
    taskType: "chat",
    requestId: "req-1",
    value: 1.0,
    weight: 1.0,
    timestamp: Date.now(),
  };
  recordQualitySignal(s);
  const snap = getQualitySnapshot("zyloo_api", "chat");
  assert.ok(snap, "snapshot should exist");
  assert.equal(snap.totalSamples, 1);
});

test("getQualitySnapshot returns undefined for unknown bucket", () => {
  const snap = getQualitySnapshot("unknown_provider", "chat");
  assert.equal(snap, undefined);
});

test("listQualitySnapshots returns all buckets", () => {
  cleanup();
  recordQualitySignal({ signalType: "execution_success", providerId: "a", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() });
  recordQualitySignal({ signalType: "execution_success", providerId: "b", taskType: "code", requestId: "2", value: 1, weight: 1, timestamp: Date.now() });
  const snaps = listQualitySnapshots();
  assert.ok(snaps.length >= 2);
  assert.ok(snaps.some(s => s.providerId === "a" && s.taskType === "chat"));
  assert.ok(snaps.some(s => s.providerId === "b" && s.taskType === "code"));
});

test("resetQualityRegistry clears specific bucket", () => {
  cleanup();
  recordQualitySignal({ signalType: "execution_success", providerId: "a", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() });
  recordQualitySignal({ signalType: "execution_success", providerId: "a", taskType: "code", requestId: "2", value: 1, weight: 1, timestamp: Date.now() });
  resetQualityRegistry("a", "chat");
  assert.equal(getQualitySnapshot("a", "chat"), undefined);
  assert.ok(getQualitySnapshot("a", "code"), "code bucket should remain");
});

test("resetQualityRegistry clears all for provider", () => {
  cleanup();
  recordQualitySignal({ signalType: "execution_success", providerId: "a", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() });
  recordQualitySignal({ signalType: "execution_success", providerId: "a", taskType: "code", requestId: "2", value: 1, weight: 1, timestamp: Date.now() });
  resetQualityRegistry("a");
  assert.equal(getQualitySnapshot("a", "chat"), undefined);
  assert.equal(getQualitySnapshot("a", "code"), undefined);
});

test("resetQualityRegistry clears all when no args", () => {
  cleanup();
  recordQualitySignal({ signalType: "execution_success", providerId: "a", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() });
  resetQualityRegistry();
  assert.ok(listQualitySnapshots().length === 0);
});

// ─── Dimension Scores ──────────────────────────────────────────────────────────

test("taskCompletion score = completed / (completed + incomplete + failed)", () => {
  cleanup();
  const signals: ProviderQualitySignal[] = [
    { signalType: "task_completed", providerId: "p", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() },
    { signalType: "task_completed", providerId: "p", taskType: "chat", requestId: "2", value: 1, weight: 1, timestamp: Date.now() },
    { signalType: "task_incomplete", providerId: "p", taskType: "chat", requestId: "3", value: 0, weight: 1, timestamp: Date.now() },
    { signalType: "task_failed", providerId: "p", taskType: "chat", requestId: "4", value: 0, weight: 1, timestamp: Date.now() },
  ];
  recordQualitySignals(signals);
  const snap = getQualitySnapshot("p", "chat")!;
  assert.ok(Math.abs(snap.dimensionScores.taskCompletion - 0.5) < 0.01); // 2/4
});

test("schemaCompliance score = valid / (valid + invalid)", () => {
  cleanup();
  const signals: ProviderQualitySignal[] = [
    { signalType: "schema_valid", providerId: "p", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() },
    { signalType: "schema_valid", providerId: "p", taskType: "chat", requestId: "2", value: 1, weight: 1, timestamp: Date.now() },
    { signalType: "schema_invalid", providerId: "p", taskType: "chat", requestId: "3", value: 0, weight: 1, timestamp: Date.now() },
  ];
  recordQualitySignals(signals);
  const snap = getQualitySnapshot("p", "chat")!;
  assert.ok(Math.abs(snap.dimensionScores.schemaCompliance - 2/3) < 0.01);
});

test("toolCallValidity score = valid / (valid + invalid)", () => {
  cleanup();
  const signals: ProviderQualitySignal[] = [
    { signalType: "tool_call_valid", providerId: "p", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() },
    { signalType: "tool_call_valid", providerId: "p", taskType: "chat", requestId: "2", value: 1, weight: 1, timestamp: Date.now() },
    { signalType: "tool_call_invalid", providerId: "p", taskType: "chat", requestId: "3", value: 0, weight: 1, timestamp: Date.now() },
  ];
  recordQualitySignals(signals);
  const snap = getQualitySnapshot("p", "chat")!;
  assert.ok(Math.abs(snap.dimensionScores.toolCallValidity - 2/3) < 0.01);
});

test("retryEfficiency = 1 - (totalRetries / executionAttempts)", () => {
  cleanup();
  // 3 execution_success, 2 retry_required with values summing to 4
  const signals: ProviderQualitySignal[] = [
    { signalType: "execution_success", providerId: "p", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() },
    { signalType: "execution_success", providerId: "p", taskType: "chat", requestId: "2", value: 1, weight: 1, timestamp: Date.now() },
    { signalType: "execution_success", providerId: "p", taskType: "chat", requestId: "3", value: 1, weight: 1, timestamp: Date.now() },
    { signalType: "retry_required", providerId: "p", taskType: "chat", requestId: "r1", value: 2, weight: 1, timestamp: Date.now() },
    { signalType: "retry_required", providerId: "p", taskType: "chat", requestId: "r2", value: 2, weight: 1, timestamp: Date.now() },
  ];
  recordQualitySignals(signals);
  const snap = getQualitySnapshot("p", "chat")!;
  // 4 retries / 3 executions = 1.33 -> min(1.33, 1) = 1 -> efficiency = 0
  assert.equal(snap.dimensionScores.retryEfficiency, 0);
});

test("fallbackAvoidance = 1 - (fallbacks / executions)", () => {
  cleanup();
  const signals: ProviderQualitySignal[] = [
    { signalType: "execution_success", providerId: "p", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() },
    { signalType: "execution_success", providerId: "p", taskType: "chat", requestId: "2", value: 1, weight: 1, timestamp: Date.now() },
    { signalType: "fallback_required", providerId: "p", taskType: "chat", requestId: "f1", value: 1, weight: 1, timestamp: Date.now() },
  ];
  recordQualitySignals(signals);
  const snap = getQualitySnapshot("p", "chat")!;
  assert.ok(Math.abs(snap.dimensionScores.fallbackAvoidance - 0.5) < 0.01); // 1 - 1/2
});

// ─── Weighted Score ────────────────────────────────────────────────────────────

test("weightedScore uses dimensionWeights", () => {
  cleanup();
  // Perfect scores across all dimensions
  const signals: ProviderQualitySignal[] = [];
  for (let i = 0; i < 30; i++) {
    signals.push(
      { signalType: "task_completed", providerId: "p", taskType: "chat", requestId: `tc${i}`, value: 1, weight: 1, timestamp: Date.now() },
      { signalType: "schema_valid", providerId: "p", taskType: "chat", requestId: `sc${i}`, value: 1, weight: 1, timestamp: Date.now() },
      { signalType: "tool_call_valid", providerId: "p", taskType: "chat", requestId: `tv${i}`, value: 1, weight: 1, timestamp: Date.now() },
      { signalType: "execution_success", providerId: "p", taskType: "chat", requestId: `ex${i}`, value: 1, weight: 1, timestamp: Date.now() },
    );
  }
  recordQualitySignals(signals);
  const snap = getQualitySnapshot("p", "chat")!;
  assert.ok(Math.abs(snap.weightedScore - 1.0) < 0.01);
});

test("weightedScore < 1.0 for imperfect dimensions", () => {
  cleanup();
  // Only taskCompletion perfect, others zero (but validatorScore defaults to 1.0)
  for (let i = 0; i < 30; i++) {
    recordQualitySignal({ signalType: "task_completed", providerId: "p", taskType: "chat", requestId: `tc${i}`, value: 1, weight: 1, timestamp: Date.now() });
  }
  const snap = getQualitySnapshot("p", "chat")!;
  // taskCompletion weight = 0.30, validatorScore weight = 0.10, others = 0 -> total = 0.40
  assert.ok(Math.abs(snap.weightedScore - 0.40) < 0.01);
});

// ─── Confidence ────────────────────────────────────────────────────────────────

test("confidence = min(samples / minimumSamplesForConfidence, 1)", () => {
  cleanup();
  for (let i = 0; i < 5; i++) {
    recordQualitySignal({ signalType: "execution_success", providerId: "p", taskType: "chat", requestId: `e${i}`, value: 1, weight: 1, timestamp: Date.now() });
  }
  const snap = getQualitySnapshot("p", "chat")!;
  assert.equal(snap.confidence, 0.25); // 5/20
});

// ─── Task Segmentation ─────────────────────────────────────────────────────────

test("buckets are segmented by taskType", () => {
  cleanup();
  recordQualitySignal({ signalType: "execution_success", providerId: "p", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() });
  recordQualitySignal({ signalType: "execution_success", providerId: "p", taskType: "code", requestId: "2", value: 1, weight: 1, timestamp: Date.now() });
  const chatSnap = getQualitySnapshot("p", "chat");
  const codeSnap = getQualitySnapshot("p", "code");
  assert.ok(chatSnap);
  assert.ok(codeSnap);
  assert.equal(chatSnap?.totalSamples, 1);
  assert.equal(codeSnap?.totalSamples, 1);
});

test("buckets are segmented by modelId", () => {
  cleanup();
  recordQualitySignal({ signalType: "execution_success", providerId: "p", modelId: "gpt-4", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() });
  recordQualitySignal({ signalType: "execution_success", providerId: "p", modelId: "gpt-3.5", taskType: "chat", requestId: "2", value: 1, weight: 1, timestamp: Date.now() });
  const s1 = getQualitySnapshot("p", "chat", "gpt-4");
  const s2 = getQualitySnapshot("p", "chat", "gpt-3.5");
  assert.ok(s1);
  assert.ok(s2);
  assert.equal(s1?.totalSamples, 1);
  assert.equal(s2?.totalSamples, 1);
});

// ─── High-Level Evaluation ─────────────────────────────────────────────────────

test("evaluateProviderQuality emits signals for execution", async () => {
  cleanup();
  const input = {
    providerId: "p",
    modelId: "gpt-4",
    taskType: "chat",
    requestId: "req-1",
    executionOk: true,
    retryCount: 0,
    fallbackUsed: false,
    taskCompleted: true,
    completionQuality: "full" as const,
    latencyMs: 100,
    timestamp: Date.now(),
  };
  const signals = await evaluateProviderQuality(input);
  assert.ok(signals.some(s => s.signalType === "execution_success"));
  assert.ok(signals.some(s => s.signalType === "task_completed"));
});

test("evaluateProviderQuality emits failure signals", async () => {
  cleanup();
  const input = {
    providerId: "p",
    modelId: "gpt-4",
    taskType: "chat",
    requestId: "req-2",
    executionOk: false,
    failureType: "quota_exhausted",
    retryCount: 2,
    fallbackUsed: true,
    taskCompleted: false,
    completionQuality: "none" as const,
    latencyMs: 5000,
    timestamp: Date.now(),
  };
  const signals = await evaluateProviderQuality(input);
  assert.ok(signals.some(s => s.signalType === "execution_failure"));
  assert.ok(signals.some(s => s.signalType === "retry_required"));
  assert.ok(signals.some(s => s.signalType === "fallback_required"));
  assert.ok(signals.some(s => s.signalType === "task_failed"));
});

test("evaluateProviderQuality handles schema validation", async () => {
  cleanup();
  const input = {
    providerId: "p",
    modelId: "gpt-4",
    taskType: "structured_output",
    requestId: "req-3",
    executionOk: true,
    retryCount: 0,
    fallbackUsed: false,
    schemaValid: true,
    toolCallsAttempted: 2,
    toolCallsValid: 1,
    taskCompleted: true,
    completionQuality: "full" as const,
    latencyMs: 100,
    timestamp: Date.now(),
  };
  const signals = await evaluateProviderQuality(input);
  assert.ok(signals.some(s => s.signalType === "schema_valid"));
  assert.ok(signals.some(s => s.signalType === "tool_call_valid"));
  assert.ok(signals.some(s => s.signalType === "tool_call_invalid"));
});

// ─── Sanitization ──────────────────────────────────────────────────────────────

test("sanitizeQualitySnapshot returns clean object", () => {
  cleanup();
  recordQualitySignal({ signalType: "execution_success", providerId: "p", taskType: "chat", requestId: "1", value: 1, weight: 1, timestamp: Date.now() });
  const snap = getQualitySnapshot("p", "chat")!;
  const sanitized = sanitizeQualitySnapshot(snap);
  assert.ok(!JSON.stringify(sanitized).includes("sk-"));
  assert.ok(!JSON.stringify(sanitized).includes("Bearer"));
});

// ─── Config ────────────────────────────────────────────────────────────────────

test("getQualityConfig returns current config", () => {
  const config = getQualityConfig();
  assert.equal(config.maxSamplesPerBucket, 100);
  assert.equal(config.minimumSamplesForConfidence, 20);
});

(async () => {
  for (const fn of seq) await fn();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();