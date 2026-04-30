import {
  recordVoiceExecutionSignal,
  getVoiceAdaptiveSummary,
  resetVoiceSignals,
  getVoiceSignalsCount,
  getRecentVoiceSignals,
  type VoiceExecutionSignal,
} from "../../../src/telegram/voiceAdaptiveSignals.js";

// ============================================================================
// Helpers
// ============================================================================

function makeSignal(overrides: Partial<VoiceExecutionSignal>): VoiceExecutionSignal {
  return {
    chatId: overrides.chatId ?? "test-chat-1",
    traceId: overrides.traceId ?? "trace-001",
    deliveryMode: overrides.deliveryMode ?? "fast_voice",
    admissionMode: overrides.admissionMode ?? "send_voice",
    qualityScore: overrides.qualityScore ?? 80,
    failureOccurred: overrides.failureOccurred ?? false,
    fallbackUsed: overrides.fallbackUsed ?? false,
    interruptionBlocked: overrides.interruptionBlocked ?? false,
    latencyMs: overrides.latencyMs ?? 1000,
    timestampMs: overrides.timestampMs ?? Date.now(),
  };
}

// ============================================================================
// TEST A — signal recording
// ============================================================================

function testSignalRecording() {
  resetVoiceSignals();

  recordVoiceExecutionSignal(makeSignal({}));

  if (getVoiceSignalsCount() !== 1) {
    throw new Error(`Expected 1 signal, got ${getVoiceSignalsCount()}`);
  }

  const recent = getRecentVoiceSignals();
  if (recent.length !== 1) {
    throw new Error(`Expected 1 recent signal, got ${recent.length}`);
  }
  if (recent[0].deliveryMode !== "fast_voice") {
    throw new Error(`Expected fast_voice delivery mode, got ${recent[0].deliveryMode}`);
  }

  console.log("✅ testSignalRecording passed");
}

// ============================================================================
// TEST B — bounded memory
// ============================================================================

function testBoundedMemory() {
  resetVoiceSignals();

  // Record 250 signals (exceeds MAX_SIGNALS = 200)
  for (let i = 0; i < 250; i++) {
    recordVoiceExecutionSignal(makeSignal({ traceId: `trace-${i}` }));
  }

  const count = getVoiceSignalsCount();
  if (count !== 200) {
    throw new Error(`Expected 200 signals (bounded), got ${count}`);
  }

  // Oldest signals should be dropped
  const recent = getRecentVoiceSignals(1);
  if (recent[0].traceId !== "trace-249") {
    throw new Error(`Expected last signal trace-249, got ${recent[0].traceId}`);
  }

  console.log("✅ testBoundedMemory passed");
}

// ============================================================================
// TEST C — summary correctness
// ============================================================================

function testSummaryCorrectness() {
  resetVoiceSignals();

  // Record 10 signals: 6 send_voice, 2 downgrade, 2 fallback
  for (let i = 0; i < 6; i++) {
    recordVoiceExecutionSignal(makeSignal({
      traceId: `success-${i}`,
      deliveryMode: "fast_voice",
      admissionMode: "send_voice",
      qualityScore: 80,
    }));
  }

  for (let i = 0; i < 2; i++) {
    recordVoiceExecutionSignal(makeSignal({
      traceId: `downgrade-${i}`,
      deliveryMode: "text_only",
      admissionMode: "downgrade_to_text",
      qualityScore: 20,
    }));
  }

  for (let i = 0; i < 2; i++) {
    recordVoiceExecutionSignal(makeSignal({
      traceId: `fallback-${i}`,
      deliveryMode: "quality_voice",
      admissionMode: "send_voice_with_caution",
      qualityScore: 50,
      fallbackUsed: true,
    }));
  }

  const summary = getVoiceAdaptiveSummary();

  if (summary.totalSignals !== 10) {
    throw new Error(`Expected 10 total signals, got ${summary.totalSignals}`);
  }

  // avg quality: (6*80 + 2*20 + 2*50) / 10 = (480 + 40 + 100) / 10 = 62
  if (summary.avgQualityScore !== 62) {
    throw new Error(`Expected avgQualityScore 62, got ${summary.avgQualityScore}`);
  }

  // voice success rate: send_voice (6) + send_voice_with_caution (2) = 8/10 = 80%
  if (summary.voiceSuccessRate !== 80) {
    throw new Error(`Expected voiceSuccessRate 80, got ${summary.voiceSuccessRate}`);
  }

  // fallback rate: 2/10 = 20%
  if (summary.fallbackRate !== 20) {
    throw new Error(`Expected fallbackRate 20, got ${summary.fallbackRate}`);
  }

  // fast vs quality ratio
  if (summary.fastVsQualityRatio.fast !== 6) {
    throw new Error(`Expected fast count 6, got ${summary.fastVsQualityRatio.fast}`);
  }
  if (summary.fastVsQualityRatio.quality !== 2) {
    throw new Error(`Expected quality count 2, got ${summary.fastVsQualityRatio.quality}`);
  }

  console.log("✅ testSummaryCorrectness passed");
}

// ============================================================================
// TEST D — deterministic aggregation
// ============================================================================

function testDeterministicAggregation() {
  resetVoiceSignals();

  recordVoiceExecutionSignal(makeSignal({ qualityScore: 70 }));
  recordVoiceExecutionSignal(makeSignal({ qualityScore: 90 }));
  recordVoiceExecutionSignal(makeSignal({ qualityScore: 50 }));

  const summary1 = getVoiceAdaptiveSummary();
  const summary2 = getVoiceAdaptiveSummary();

  if (JSON.stringify(summary1) !== JSON.stringify(summary2)) {
    throw new Error("Summary should be deterministic");
  }

  // avg: (70 + 90 + 50) / 3 = 70
  if (summary1.avgQualityScore !== 70) {
    throw new Error(`Expected avgQualityScore 70, got ${summary1.avgQualityScore}`);
  }

  console.log("✅ testDeterministicAggregation passed");
}

// ============================================================================
// TEST E — empty summary
// ============================================================================

function testEmptySummary() {
  resetVoiceSignals();

  const summary = getVoiceAdaptiveSummary();

  if (summary.totalSignals !== 0) {
    throw new Error(`Expected 0 signals, got ${summary.totalSignals}`);
  }
  if (summary.avgQualityScore !== 0) {
    throw new Error(`Expected avgQualityScore 0, got ${summary.avgQualityScore}`);
  }
  if (summary.voiceSuccessRate !== 0) {
    throw new Error(`Expected voiceSuccessRate 0, got ${summary.voiceSuccessRate}`);
  }
  if (summary.fastVsQualityRatio.fast !== 0) {
    throw new Error(`Expected fast count 0, got ${summary.fastVsQualityRatio.fast}`);
  }

  console.log("✅ testEmptySummary passed");
}

// ============================================================================
// TEST F — interruption block rate
// ============================================================================

function testInterruptionBlockRate() {
  resetVoiceSignals();

  for (let i = 0; i < 5; i++) {
    recordVoiceExecutionSignal(makeSignal({ traceId: `normal-${i}` }));
  }

  for (let i = 0; i < 3; i++) {
    recordVoiceExecutionSignal(makeSignal({
      traceId: `blocked-${i}`,
      interruptionBlocked: true,
      admissionMode: "downgrade_to_text",
    }));
  }

  const summary = getVoiceAdaptiveSummary();

  // interruption block rate: 3/8 = 37.5% → rounds to 38%
  if (summary.interruptionBlockRate !== 38) {
    throw new Error(`Expected interruptionBlockRate 38, got ${summary.interruptionBlockRate}`);
  }

  console.log("✅ testInterruptionBlockRate passed");
}

// ============================================================================
// TEST G — getRecentVoiceSignals returns last N
// ============================================================================

function testGetRecentVoiceSignals() {
  resetVoiceSignals();

  for (let i = 0; i < 10; i++) {
    recordVoiceExecutionSignal(makeSignal({ traceId: `sig-${i}` }));
  }

  const last3 = getRecentVoiceSignals(3);
  if (last3.length !== 3) {
    throw new Error(`Expected 3 recent signals, got ${last3.length}`);
  }
  if (last3[0].traceId !== "sig-7" || last3[2].traceId !== "sig-9") {
    throw new Error(`Expected traces sig-7, sig-8, sig-9, got ${last3.map(s => s.traceId).join(", ")}`);
  }

  console.log("✅ testGetRecentVoiceSignals passed");
}

// ============================================================================
// TEST H — reset clears all signals
// ============================================================================

function testResetClearsSignals() {
  resetVoiceSignals();

  for (let i = 0; i < 5; i++) {
    recordVoiceExecutionSignal(makeSignal({ traceId: `pre-reset-${i}` }));
  }

  if (getVoiceSignalsCount() !== 5) {
    throw new Error(`Expected 5 signals before reset, got ${getVoiceSignalsCount()}`);
  }

  resetVoiceSignals();

  if (getVoiceSignalsCount() !== 0) {
    throw new Error(`Expected 0 signals after reset, got ${getVoiceSignalsCount()}`);
  }

  const summary = getVoiceAdaptiveSummary();
  if (summary.totalSignals !== 0) {
    throw new Error(`Expected 0 total signals after reset, got ${summary.totalSignals}`);
  }

  console.log("✅ testResetClearsSignals passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Adaptive Signals Tests ===\n");

try {
  testSignalRecording();
  testBoundedMemory();
  testSummaryCorrectness();
  testDeterministicAggregation();
  testEmptySummary();
  testInterruptionBlockRate();
  testGetRecentVoiceSignals();
  testResetClearsSignals();

  console.log("\n✅ All voice adaptive signals tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
