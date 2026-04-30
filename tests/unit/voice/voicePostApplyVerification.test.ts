import {
  evaluateVoicePostApplyVerification,
  executeVoiceRollback,
  formatVoicePostApplyVerification,
  storePatchBaseline,
  getPatchBaseline,
  clearPatchBaseline,
  getPatchBaselineCount,
  resetPatchBaselines,
  type EvaluateVoicePostApplyInput,
  type VoicePostApplyVerificationResult,
} from "../../../src/telegram/voicePostApplyVerification.js";
import type { VoiceApplyExecution } from "../../../src/telegram/voiceControlledApplyEngine.js";
import type { VoiceAdaptiveSummary } from "../../../src/telegram/voiceAdaptiveSignals.js";

// ============================================================================
// Helpers
// ============================================================================

function makeExecution(overrides: Partial<VoiceApplyExecution>): VoiceApplyExecution {
  return {
    patchId: overrides.patchId ?? "patch_fast_preference",
    applied: overrides.applied ?? true,
    appliedAtMs: overrides.appliedAtMs ?? Date.now() - 60000,
    rollbackAvailable: overrides.rollbackAvailable ?? true,
    rollbackId: overrides.rollbackId ?? "rollback_patch_fast_preference_1234567890",
    reason: overrides.reason ?? "latency_optimization_safe_patch",
  };
}

function makeSummary(overrides: Partial<VoiceAdaptiveSummary>): VoiceAdaptiveSummary {
  return {
    totalSignals: overrides.totalSignals ?? 50,
    avgQualityScore: overrides.avgQualityScore ?? 75,
    voiceSuccessRate: overrides.voiceSuccessRate ?? 85,
    fallbackRate: overrides.fallbackRate ?? 8,
    interruptionBlockRate: overrides.interruptionBlockRate ?? 5,
    fastVsQualityRatio: overrides.fastVsQualityRatio ?? { fast: 30, quality: 20 },
  };
}

function makeInput(overrides: Partial<EvaluateVoicePostApplyInput>): EvaluateVoicePostApplyInput {
  return {
    execution: overrides.execution ?? makeExecution({}),
    beforeSummary: overrides.beforeSummary ?? makeSummary({}),
    afterSummary: overrides.afterSummary ?? makeSummary({}),
    minObservationSignals: overrides.minObservationSignals,
  };
}

// ============================================================================
// TEST 1 — holds_when_patch_was_not_applied
// ============================================================================

function testHoldsWhenPatchWasNotApplied() {
  const input = makeInput({
    execution: makeExecution({ applied: false }),
  });

  const result = evaluateVoicePostApplyVerification(input);

  if (result.decision !== "hold_observation") {
    throw new Error(`Expected hold_observation, got ${result.decision}`);
  }
  if (result.reason !== "patch_not_applied") {
    throw new Error(`Expected patch_not_applied reason, got ${result.reason}`);
  }
  if (result.confidence !== "low") {
    throw new Error(`Expected low confidence, got ${result.confidence}`);
  }
  if (!result.warnings.includes("verification_requires_applied_patch")) {
    throw new Error("Missing verification_requires_applied_patch warning");
  }

  console.log("✅ testHoldsWhenPatchWasNotApplied passed");
}

// ============================================================================
// TEST 2 — holds_when_observation_window_too_small
// ============================================================================

function testHoldsWhenObservationWindowTooSmall() {
  const input = makeInput({
    afterSummary: makeSummary({ totalSignals: 5 }),
    minObservationSignals: 12,
  });

  const result = evaluateVoicePostApplyVerification(input);

  if (result.decision !== "hold_observation") {
    throw new Error(`Expected hold_observation, got ${result.decision}`);
  }
  if (result.reason !== "insufficient_post_apply_evidence") {
    throw new Error(`Expected insufficient_post_apply_evidence, got ${result.reason}`);
  }
  if (result.confidence !== "low") {
    throw new Error(`Expected low confidence, got ${result.confidence}`);
  }

  console.log("✅ testHoldsWhenObservationWindowTooSmall passed");
}

// ============================================================================
// TEST 3 — confirms_patch_when_success_improves
// ============================================================================

function testConfirmsPatchWhenSuccessImproves() {
  const input = makeInput({
    beforeSummary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 80,
      fallbackRate: 10,
      avgQualityScore: 72,
    }),
    afterSummary: makeSummary({
      totalSignals: 60,
      voiceSuccessRate: 88, // +8% improvement
      fallbackRate: 8, // stable
      avgQualityScore: 74, // stable
    }),
  });

  const result = evaluateVoicePostApplyVerification(input);

  if (result.decision !== "confirm_patch") {
    throw new Error(`Expected confirm_patch, got ${result.decision}`);
  }
  if (result.reason !== "patch_improved_runtime") {
    throw new Error(`Expected patch_improved_runtime, got ${result.reason}`);
  }
  if (result.confidence !== "high") {
    throw new Error(`Expected high confidence, got ${result.confidence}`);
  }
  if (!result.improvements.includes("voice_success_improved")) {
    throw new Error("Missing voice_success_improved improvement");
  }
  if (!result.improvements.includes("fallback_not_worsened")) {
    throw new Error("Missing fallback_not_worsened improvement");
  }
  if (result.regressions.length > 0) {
    throw new Error("Should have no regressions for confirmed patch");
  }

  console.log("✅ testConfirmsPatchWhenSuccessImproves passed");
}

// ============================================================================
// TEST 4 — rolls_back_when_fallback_spikes_after_patch
// ============================================================================

function testRollsBackWhenFallbackSpikesAfterPatch() {
  const input = makeInput({
    beforeSummary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 85,
      fallbackRate: 8,
      avgQualityScore: 75,
    }),
    afterSummary: makeSummary({
      totalSignals: 60,
      voiceSuccessRate: 80,
      fallbackRate: 20, // +12% spike (threshold is 8%)
      avgQualityScore: 73,
    }),
  });

  const result = evaluateVoicePostApplyVerification(input);

  if (result.decision !== "rollback_patch") {
    throw new Error(`Expected rollback_patch, got ${result.decision}`);
  }
  if (result.reason !== "patch_caused_regression") {
    throw new Error(`Expected patch_caused_regression, got ${result.reason}`);
  }
  if (result.confidence !== "high") {
    throw new Error(`Expected high confidence, got ${result.confidence}`);
  }
  if (!result.regressions.includes("fallback_spiked")) {
    throw new Error("Missing fallback_spiked regression");
  }
  if (!result.warnings.includes("rollback_recommended_due_to_regression")) {
    throw new Error("Missing rollback warning");
  }

  console.log("✅ testRollsBackWhenFallbackSpikesAfterPatch passed");
}

// ============================================================================
// TEST 5 — rolls_back_when_quality_drops_hard
// ============================================================================

function testRollsBackWhenQualityDropsHard() {
  const input = makeInput({
    beforeSummary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 85,
      fallbackRate: 8,
      avgQualityScore: 80,
    }),
    afterSummary: makeSummary({
      totalSignals: 60,
      voiceSuccessRate: 84,
      fallbackRate: 8,
      avgQualityScore: 68, // -12 points (threshold is 8)
    }),
  });

  const result = evaluateVoicePostApplyVerification(input);

  if (result.decision !== "rollback_patch") {
    throw new Error(`Expected rollback_patch, got ${result.decision}`);
  }
  if (!result.regressions.includes("quality_dropped")) {
    throw new Error("Missing quality_dropped regression");
  }

  console.log("✅ testRollsBackWhenQualityDropsHard passed");
}

// ============================================================================
// TEST 6 — holds_when_signals_are_mixed
// ============================================================================

function testHoldsWhenSignalsAreMixed() {
  const input = makeInput({
    beforeSummary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 85,
      fallbackRate: 8,
      avgQualityScore: 75,
    }),
    afterSummary: makeSummary({
      totalSignals: 60,
      voiceSuccessRate: 87, // +2% (not enough for confirm, threshold is 5%)
      fallbackRate: 10, // +2% (not enough for rollback, threshold is 8%)
      avgQualityScore: 70, // -5 (within tolerance)
    }),
  });

  const result = evaluateVoicePostApplyVerification(input);

  if (result.decision !== "hold_observation") {
    throw new Error(`Expected hold_observation for mixed signals, got ${result.decision}`);
  }
  if (result.reason !== "mixed_post_apply_signals") {
    throw new Error(`Expected mixed_post_apply_signals, got ${result.reason}`);
  }
  if (result.confidence !== "medium") {
    throw new Error(`Expected medium confidence, got ${result.confidence}`);
  }

  console.log("✅ testHoldsWhenSignalsAreMixed passed");
}

// ============================================================================
// TEST 7 — includes_before_and_after_metrics
// ============================================================================

function testIncludesBeforeAndAfterMetrics() {
  const before = makeSummary({
    voiceSuccessRate: 80,
    fallbackRate: 10,
    interruptionBlockRate: 6,
    avgQualityScore: 70,
  });
  const after = makeSummary({
    voiceSuccessRate: 90,
    fallbackRate: 5,
    interruptionBlockRate: 3,
    avgQualityScore: 78,
  });

  const input = makeInput({ beforeSummary: before, afterSummary: after });
  const result = evaluateVoicePostApplyVerification(input);

  // Check before metrics
  if (result.beforeMetrics.voiceSuccessRate !== 80) {
    throw new Error(`Wrong before voiceSuccessRate: ${result.beforeMetrics.voiceSuccessRate}`);
  }
  if (result.beforeMetrics.fallbackRate !== 10) {
    throw new Error(`Wrong before fallbackRate: ${result.beforeMetrics.fallbackRate}`);
  }
  if (result.beforeMetrics.interruptionBlockRate !== 6) {
    throw new Error(`Wrong before interruptionBlockRate: ${result.beforeMetrics.interruptionBlockRate}`);
  }
  if (result.beforeMetrics.avgQualityScore !== 70) {
    throw new Error(`Wrong before avgQualityScore: ${result.beforeMetrics.avgQualityScore}`);
  }

  // Check after metrics
  if (result.afterMetrics.voiceSuccessRate !== 90) {
    throw new Error(`Wrong after voiceSuccessRate: ${result.afterMetrics.voiceSuccessRate}`);
  }
  if (result.afterMetrics.fallbackRate !== 5) {
    throw new Error(`Wrong after fallbackRate: ${result.afterMetrics.fallbackRate}`);
  }

  console.log("✅ testIncludesBeforeAndAfterMetrics passed");
}

// ============================================================================
// TEST 8 — includes_improvements_and_regressions
// ============================================================================

function testIncludesImprovementsAndRegressions() {
  const input = makeInput({
    beforeSummary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 85,
      fallbackRate: 8,
      avgQualityScore: 75,
    }),
    afterSummary: makeSummary({
      totalSignals: 60,
      voiceSuccessRate: 78, // -7%
      fallbackRate: 18, // +10%
      avgQualityScore: 70, // -5
    }),
  });

  const result = evaluateVoicePostApplyVerification(input);

  // Mixed signals with negative deltas → should have regressions and warnings
  if (result.regressions.length === 0) {
    throw new Error("Expected some regressions for degraded metrics");
  }

  console.log("✅ testIncludesImprovementsAndRegressions passed");
}

// ============================================================================
// TEST 9 — executes_rollback_only_for_rollback_decision
// ============================================================================

function testExecutesRollbackOnlyForRollbackDecision() {
  // Rollback decision
  const rollbackVerification: VoicePostApplyVerificationResult = {
    patchId: "patch_fast_preference",
    rollbackId: "rollback_123",
    decision: "rollback_patch",
    reason: "patch_caused_regression",
    confidence: "high",
    observationWindowSignals: 20,
    beforeMetrics: { voiceSuccessRate: 85, fallbackRate: 8, interruptionBlockRate: 5, avgQualityScore: 75 },
    afterMetrics: { voiceSuccessRate: 75, fallbackRate: 20, interruptionBlockRate: 8, avgQualityScore: 65 },
    improvements: [],
    regressions: ["voice_success_regressed", "fallback_spiked"],
    warnings: ["rollback_recommended_due_to_regression"],
    generatedAtMs: Date.now(),
  };

  const rollbackResult = executeVoiceRollback(rollbackVerification);

  if (!rollbackResult.rolledBack) {
    throw new Error("Should rollback for rollback_patch decision");
  }
  if (rollbackResult.rollbackId !== "rollback_123") {
    throw new Error(`Expected rollback_123, got ${rollbackResult.rollbackId}`);
  }

  // Confirm decision → no rollback
  const confirmVerification: VoicePostApplyVerificationResult = {
    patchId: "patch_fast_preference",
    rollbackId: "rollback_456",
    decision: "confirm_patch",
    reason: "patch_improved_runtime",
    confidence: "high",
    observationWindowSignals: 30,
    beforeMetrics: { voiceSuccessRate: 80, fallbackRate: 10, interruptionBlockRate: 5, avgQualityScore: 70 },
    afterMetrics: { voiceSuccessRate: 90, fallbackRate: 5, interruptionBlockRate: 3, avgQualityScore: 75 },
    improvements: ["voice_success_improved"],
    regressions: [],
    warnings: [],
    generatedAtMs: Date.now(),
  };

  const noRollbackResult = executeVoiceRollback(confirmVerification);

  if (noRollbackResult.rolledBack) {
    throw new Error("Should NOT rollback for confirm_patch decision");
  }
  if (noRollbackResult.reason !== "rollback_not_required") {
    throw new Error(`Expected rollback_not_required, got ${noRollbackResult.reason}`);
  }

  console.log("✅ testExecutesRollbackOnlyForRollbackDecision passed");
}

// ============================================================================
// TEST 10 — returns_deterministic_verification_output
// ============================================================================

function testDeterministicVerificationOutput() {
  const input = makeInput({
    beforeSummary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 85,
      fallbackRate: 8,
      avgQualityScore: 75,
    }),
    afterSummary: makeSummary({
      totalSignals: 60,
      voiceSuccessRate: 92,
      fallbackRate: 6,
      avgQualityScore: 78,
    }),
  });

  const result1 = evaluateVoicePostApplyVerification(input);
  const result2 = evaluateVoicePostApplyVerification(input);

  // Strip generatedAtMs for comparison
  const r1 = { ...result1, generatedAtMs: 0 };
  const r2 = { ...result2, generatedAtMs: 0 };

  if (JSON.stringify(r1) !== JSON.stringify(r2)) {
    throw new Error("Verification should be deterministic with same inputs");
  }

  console.log("✅ testDeterministicVerificationOutput passed");
}

// ============================================================================
// TEST 11 — returns_not_rolled_back_when_rollback_id_missing
// ============================================================================

function testReturnsNotRolledBackWhenRollbackIdMissing() {
  const verification: VoicePostApplyVerificationResult = {
    patchId: "patch_fast_preference",
    // No rollbackId
    decision: "rollback_patch",
    reason: "patch_caused_regression",
    confidence: "high",
    observationWindowSignals: 20,
    beforeMetrics: { voiceSuccessRate: 85, fallbackRate: 8, interruptionBlockRate: 5, avgQualityScore: 75 },
    afterMetrics: { voiceSuccessRate: 75, fallbackRate: 20, interruptionBlockRate: 8, avgQualityScore: 65 },
    improvements: [],
    regressions: ["voice_success_regressed"],
    warnings: ["rollback_recommended_due_to_regression"],
    generatedAtMs: Date.now(),
  };

  const result = executeVoiceRollback(verification);

  if (result.rolledBack) {
    throw new Error("Should NOT rollback when rollbackId is missing");
  }
  if (result.reason !== "rollback_id_missing") {
    throw new Error(`Expected rollback_id_missing, got ${result.reason}`);
  }

  console.log("✅ testReturnsNotRolledBackWhenRollbackIdMissing passed");
}

// ============================================================================
// TEST 12 — formats_verification_result_for_human_reading
// ============================================================================

function testFormatsVerificationResultForHumanReading() {
  const input = makeInput({
    beforeSummary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 80,
      fallbackRate: 10,
      interruptionBlockRate: 6,
      avgQualityScore: 70,
    }),
    afterSummary: makeSummary({
      totalSignals: 65,
      voiceSuccessRate: 90,
      fallbackRate: 5,
      interruptionBlockRate: 3,
      avgQualityScore: 75,
    }),
  });

  const result = evaluateVoicePostApplyVerification(input);
  const formatted = formatVoicePostApplyVerification(result);

  if (!formatted.includes("🎛 Voice Post-Apply Verification")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("confirm_patch")) {
    throw new Error("Missing decision in formatted output");
  }
  if (!formatted.includes("80% → 90%")) {
    throw new Error("Missing success delta in formatted output");
  }
  if (!formatted.includes("10% → 5%")) {
    throw new Error("Missing fallback delta in formatted output");
  }

  console.log("✅ testFormatsVerificationResultForHumanReading passed");
}

// ============================================================================
// TEST 13 — bounded baseline storage
// ============================================================================

function testBoundedBaselineStorage() {
  resetPatchBaselines();

  // Store a baseline
  storePatchBaseline({
    patchId: "patch-test-1",
    rollbackId: "rollback-test-1",
    beforeSummary: makeSummary({}),
    appliedAtMs: Date.now(),
  });

  if (getPatchBaselineCount() !== 1) {
    throw new Error(`Expected 1 baseline, got ${getPatchBaselineCount()}`);
  }

  const retrieved = getPatchBaseline("patch-test-1");
  if (!retrieved) {
    throw new Error("Baseline should be retrievable");
  }
  if (retrieved.patchId !== "patch-test-1") {
    throw new Error(`Wrong patchId: ${retrieved.patchId}`);
  }

  clearPatchBaseline("patch-test-1");
  if (getPatchBaselineCount() !== 0) {
    throw new Error("Baseline should be cleared");
  }

  console.log("✅ testBoundedBaselineStorage passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Post-Apply Verification Tests ===\n");

try {
  testHoldsWhenPatchWasNotApplied();
  testHoldsWhenObservationWindowTooSmall();
  testConfirmsPatchWhenSuccessImproves();
  testRollsBackWhenFallbackSpikesAfterPatch();
  testRollsBackWhenQualityDropsHard();
  testHoldsWhenSignalsAreMixed();
  testIncludesBeforeAndAfterMetrics();
  testIncludesImprovementsAndRegressions();
  testExecutesRollbackOnlyForRollbackDecision();
  testDeterministicVerificationOutput();
  testReturnsNotRolledBackWhenRollbackIdMissing();
  testFormatsVerificationResultForHumanReading();
  testBoundedBaselineStorage();

  console.log("\n✅ All voice post-apply verification tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
