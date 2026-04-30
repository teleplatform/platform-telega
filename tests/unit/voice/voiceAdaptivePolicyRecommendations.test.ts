import {
  evaluateVoicePolicyRecommendations,
  formatVoicePolicyRecommendation,
  type VoicePolicyRecommendationInput,
} from "../../../src/telegram/voiceAdaptivePolicyRecommendations.js";

// ============================================================================
// Helpers
// ============================================================================

function makeInput(overrides: Partial<VoicePolicyRecommendationInput>): VoicePolicyRecommendationInput {
  return {
    totalSignals: overrides.totalSignals ?? 50,
    voiceSuccessRate: overrides.voiceSuccessRate ?? 80,
    fallbackRate: overrides.fallbackRate ?? 10,
    interruptionBlockRate: overrides.interruptionBlockRate ?? 5,
    avgQualityScore: overrides.avgQualityScore ?? 70,
    fastCount: overrides.fastCount ?? 30,
    qualityCount: overrides.qualityCount ?? 20,
    avgLatencyMs: overrides.avgLatencyMs ?? 5000,
    avgFastProviderLatencyMs: overrides.avgFastProviderLatencyMs ?? 3000,
    avgQualityProviderLatencyMs: overrides.avgQualityProviderLatencyMs ?? 35000,
    staleConflictRate: overrides.staleConflictRate ?? 2,
  };
}

// ============================================================================
// TEST 1 — returns_no_change_when_signal_volume_is_too_low
// ============================================================================

function testNoChangeWhenSignalVolumeLow() {
  const input = makeInput({
    totalSignals: 5,
  });

  const rec = evaluateVoicePolicyRecommendations(input);

  if (rec.recommendationType !== "no_change") {
    throw new Error(`Expected no_change for low signals, got ${rec.recommendationType}`);
  }
  if (rec.confidence !== "low") {
    throw new Error(`Expected low confidence for low signals, got ${rec.confidence}`);
  }
  if (!rec.reasons.includes("insufficient_signal_volume")) {
    throw new Error("Missing insufficient_signal_volume reason");
  }

  console.log("✅ testNoChangeWhenSignalVolumeLow passed");
}

// ============================================================================
// TEST 2 — recommends_fast_voice_when_quality_latency_is_high
// ============================================================================

function testRecommendsFastVoiceWhenQualityLatencyHigh() {
  const input = makeInput({
    totalSignals: 40,
    fastCount: 25,
    qualityCount: 15,
    avgFastProviderLatencyMs: 3000,
    avgQualityProviderLatencyMs: 45000, // 42s gap
    voiceSuccessRate: 85,
    fallbackRate: 8,
  });

  const rec = evaluateVoicePolicyRecommendations(input);

  if (rec.recommendationType !== "prefer_fast_voice_for_short_replies") {
    throw new Error(`Expected prefer_fast_voice_for_short_replies, got ${rec.recommendationType}`);
  }
  if (rec.confidence !== "high") {
    throw new Error(`Expected high confidence for large latency gap, got ${rec.confidence}`);
  }
  if (!rec.reasons.includes("fast_voice_significantly_lower_latency")) {
    throw new Error("Missing fast_voice_significantly_lower_latency reason");
  }
  if (!rec.doNotApplyAutomatically) {
    throw new Error("doNotApplyAutomatically must be true");
  }

  console.log("✅ testRecommendsFastVoiceWhenQualityLatencyHigh passed");
}

// ============================================================================
// TEST 3 — recommends_quality_voice_when_session_is_stable
// ============================================================================

function testRecommendsQualityVoiceWhenStableSession() {
  const input = makeInput({
    totalSignals: 60,
    fastCount: 20,
    qualityCount: 40,
    avgQualityScore: 85,
    interruptionBlockRate: 5,
    voiceSuccessRate: 90,
    avgQualityProviderLatencyMs: 30000, // within acceptable
    fallbackRate: 5,
  });

  const rec = evaluateVoicePolicyRecommendations(input);

  if (rec.recommendationType !== "prefer_quality_voice_for_stable_sessions") {
    throw new Error(`Expected prefer_quality_voice_for_stable_sessions, got ${rec.recommendationType}`);
  }
  if (rec.confidence !== "high") {
    throw new Error(`Expected high confidence for score > 80, got ${rec.confidence}`);
  }
  if (!rec.reasons.includes("quality_voice_quality_score_high")) {
    throw new Error("Missing quality_voice_quality_score_high reason");
  }

  console.log("✅ testRecommendsQualityVoiceWhenStableSession passed");
}

// ============================================================================
// TEST 4 — recommends_reduce_voice_usage_when_fallback_spikes
// ============================================================================

function testRecommendsReduceVoiceWhenFallbackSpikes() {
  const input = makeInput({
    totalSignals: 50,
    fallbackRate: 45,
    voiceSuccessRate: 55,
    avgQualityScore: 40,
  });

  const rec = evaluateVoicePolicyRecommendations(input);

  if (rec.recommendationType !== "reduce_voice_usage_when_fallback_spikes") {
    throw new Error(`Expected reduce_voice_usage_when_fallback_spikes, got ${rec.recommendationType}`);
  }
  if (rec.confidence !== "medium") {
    throw new Error(`Expected medium confidence for fallback > 30%, got ${rec.confidence}`);
  }
  if (!rec.reasons.includes("fallback_rate_exceeds_threshold")) {
    throw new Error("Missing fallback_rate_exceeds_threshold reason");
  }

  console.log("✅ testRecommendsReduceVoiceWhenFallbackSpikes passed");
}

// ============================================================================
// TEST 5 — recommends_lower_interruption_guard_when_blocks_are_too_high
// ============================================================================

function testRecommendsLowerInterruptionGuardWhenBlocksTooHigh() {
  const input = makeInput({
    totalSignals: 40,
    interruptionBlockRate: 35,
    staleConflictRate: 3,
    voiceSuccessRate: 65,
  });

  const rec = evaluateVoicePolicyRecommendations(input);

  if (rec.recommendationType !== "lower_interruption_guard_sensitivity") {
    throw new Error(`Expected lower_interruption_guard_sensitivity, got ${rec.recommendationType}`);
  }
  if (rec.confidence !== "medium") {
    throw new Error(`Expected medium confidence, got ${rec.confidence}`);
  }
  if (!rec.reasons.includes("interruption_block_rate_high")) {
    throw new Error("Missing interruption_block_rate_high reason");
  }
  if (!rec.warnings.includes("reducing_sensitivity_could_increase_stale_voice_risk")) {
    throw new Error("Missing stale_voice_risk warning");
  }

  console.log("✅ testRecommendsLowerInterruptionGuardWhenBlocksTooHigh passed");
}

// ============================================================================
// TEST 6 — recommends_raise_interruption_guard_when_stale_risk_is_detected
// ============================================================================

function testRecommendsRaiseInterruptionGuardWhenStaleRiskDetected() {
  const input = makeInput({
    totalSignals: 40,
    interruptionBlockRate: 10, // low
    staleConflictRate: 15, // high
    voiceSuccessRate: 70,
  });

  const rec = evaluateVoicePolicyRecommendations(input);

  if (rec.recommendationType !== "raise_interruption_guard_sensitivity") {
    throw new Error(`Expected raise_interruption_guard_sensitivity, got ${rec.recommendationType}`);
  }
  if (rec.confidence !== "medium") {
    throw new Error(`Expected medium confidence, got ${rec.confidence}`);
  }
  if (!rec.reasons.includes("stale_conflict_rate_above_threshold")) {
    throw new Error("Missing stale_conflict_rate_above_threshold reason");
  }

  console.log("✅ testRecommendsRaiseInterruptionGuardWhenStaleRiskDetected passed");
}

// ============================================================================
// TEST 7 — includes_confidence_and_metrics_in_output
// ============================================================================

function testIncludesConfidenceAndMetrics() {
  const input = makeInput({
    totalSignals: 50,
    voiceSuccessRate: 90,
    fallbackRate: 5,
    interruptionBlockRate: 3,
    avgQualityScore: 80,
    fastCount: 25,
    qualityCount: 25,
    avgLatencyMs: 10000,
  });

  const rec = evaluateVoicePolicyRecommendations(input);

  // Check confidence is present and valid
  if (!["low", "medium", "high"].includes(rec.confidence)) {
    throw new Error(`Invalid confidence value: ${rec.confidence}`);
  }

  // Check all metrics are present
  if (typeof rec.metrics.voiceSuccessRate !== "number") {
    throw new Error("Missing voiceSuccessRate in metrics");
  }
  if (typeof rec.metrics.fallbackRate !== "number") {
    throw new Error("Missing fallbackRate in metrics");
  }
  if (typeof rec.metrics.interruptionBlockRate !== "number") {
    throw new Error("Missing interruptionBlockRate in metrics");
  }
  if (typeof rec.metrics.avgQualityScore !== "number") {
    throw new Error("Missing avgQualityScore in metrics");
  }
  if (typeof rec.metrics.fastCount !== "number") {
    throw new Error("Missing fastCount in metrics");
  }
  if (typeof rec.metrics.qualityCount !== "number") {
    throw new Error("Missing qualityCount in metrics");
  }
  if (typeof rec.metrics.avgLatencyMs !== "number") {
    throw new Error("Missing avgLatencyMs in metrics");
  }

  // Check evidenceWindowSize
  if (rec.evidenceWindowSize !== 50) {
    throw new Error(`Expected evidenceWindowSize 50, got ${rec.evidenceWindowSize}`);
  }

  // Check generatedAtMs is reasonable
  if (rec.generatedAtMs < Date.now() - 10000 || rec.generatedAtMs > Date.now() + 1000) {
    throw new Error("generatedAtMs is not within reasonable range");
  }

  console.log("✅ testIncludesConfidenceAndMetrics passed");
}

// ============================================================================
// TEST 8 — never_marks_recommendation_as_auto_apply
// ============================================================================

function testNeverMarksRecommendationAsAutoApply() {
  const inputs = [
    makeInput({ totalSignals: 40, fastCount: 25, qualityCount: 15, avgFastProviderLatencyMs: 3000, avgQualityProviderLatencyMs: 45000, voiceSuccessRate: 85, fallbackRate: 8 }),
    makeInput({ totalSignals: 60, qualityCount: 40, avgQualityScore: 85, interruptionBlockRate: 5, voiceSuccessRate: 90, avgQualityProviderLatencyMs: 30000 }),
    makeInput({ totalSignals: 50, fallbackRate: 45, voiceSuccessRate: 55 }),
    makeInput({ totalSignals: 40, interruptionBlockRate: 35, staleConflictRate: 3 }),
    makeInput({ totalSignals: 40, interruptionBlockRate: 10, staleConflictRate: 15 }),
    makeInput({ totalSignals: 50, voiceSuccessRate: 90, fallbackRate: 5, interruptionBlockRate: 3 }),
  ];

  for (const input of inputs) {
    const rec = evaluateVoicePolicyRecommendations(input);
    if (rec.doNotApplyAutomatically !== true) {
      throw new Error(`Recommendation ${rec.recommendationType} must have doNotApplyAutomatically === true`);
    }
  }

  console.log("✅ testNeverMarksRecommendationAsAutoApply passed");
}

// ============================================================================
// TEST 9 — formatVoicePolicyRecommendation produces readable output
// ============================================================================

function testFormatRecommendation() {
  const input = makeInput({
    totalSignals: 50,
    voiceSuccessRate: 90,
    fallbackRate: 5,
    interruptionBlockRate: 3,
    avgQualityScore: 80,
    fastCount: 25,
    qualityCount: 25,
    avgLatencyMs: 10000,
  });

  const rec = evaluateVoicePolicyRecommendations(input);
  const formatted = formatVoicePolicyRecommendation(rec);

  if (!formatted.includes(rec.recommendationType)) {
    throw new Error("Formatted output must include recommendation type");
  }
  if (!formatted.includes(rec.confidence)) {
    throw new Error("Formatted output must include confidence");
  }
  if (!formatted.includes("NO (advisory only)")) {
    throw new Error("Formatted output must indicate advisory-only");
  }

  console.log("✅ testFormatRecommendation passed");
}

// ============================================================================
// TEST 10 — review_quality_thresholds_when_quality_is_low
// ============================================================================

function testReviewQualityThresholdsWhenQualityLow() {
  const input = makeInput({
    totalSignals: 50,
    avgQualityScore: 30, // very low
    voiceSuccessRate: 60,
    fallbackRate: 20,
    interruptionBlockRate: 10,
  });

  const rec = evaluateVoicePolicyRecommendations(input);

  if (rec.recommendationType !== "review_quality_thresholds") {
    throw new Error(`Expected review_quality_thresholds, got ${rec.recommendationType}`);
  }
  if (rec.confidence !== "low") {
    throw new Error(`Expected low confidence, got ${rec.confidence}`);
  }

  console.log("✅ testReviewQualityThresholdsWhenQualityLow passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Adaptive Policy Recommendation Tests ===\n");

try {
  testNoChangeWhenSignalVolumeLow();
  testRecommendsFastVoiceWhenQualityLatencyHigh();
  testRecommendsQualityVoiceWhenStableSession();
  testRecommendsReduceVoiceWhenFallbackSpikes();
  testRecommendsLowerInterruptionGuardWhenBlocksTooHigh();
  testRecommendsRaiseInterruptionGuardWhenStaleRiskDetected();
  testIncludesConfidenceAndMetrics();
  testNeverMarksRecommendationAsAutoApply();
  testFormatRecommendation();
  testReviewQualityThresholdsWhenQualityLow();

  console.log("\n✅ All voice policy recommendation tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
