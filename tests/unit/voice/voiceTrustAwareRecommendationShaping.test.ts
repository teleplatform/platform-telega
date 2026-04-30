import {
  shapeVoiceRecommendationWithTrust,
  formatVoiceShapedRecommendation,
  type VoiceShapedRecommendation,
} from "../../../src/telegram/voiceTrustAwareRecommendationShaping.js";
import type { VoicePolicyRecommendation } from "../../../src/telegram/voiceAdaptivePolicyRecommendations.js";
import {
  rememberVoicePatchHistory,
  resetVoicePatchHistory,
} from "../../../src/telegram/voicePatchHistoryMemory.js";

// ============================================================================
// Helpers
// ============================================================================

const sampleMetrics = {
  voiceSuccessRate: 85,
  fallbackRate: 8,
  interruptionBlockRate: 5,
  avgQualityScore: 75,
};

function makeRecommendation(overrides: Partial<VoicePolicyRecommendation>): VoicePolicyRecommendation {
  return {
    recommendationType: overrides.recommendationType ?? "prefer_fast_voice_for_short_replies",
    confidence: overrides.confidence ?? "medium",
    summary: overrides.summary ?? "Recommendation summary.",
    evidenceWindowSize: overrides.evidenceWindowSize ?? 50,
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    metrics: overrides.metrics ?? {
      voiceSuccessRate: 85,
      fallbackRate: 8,
      interruptionBlockRate: 5,
      avgQualityScore: 75,
      fastCount: 30,
      qualityCount: 20,
      avgLatencyMs: 5000,
    },
    reasons: overrides.reasons ?? ["strong_evidence"],
    warnings: overrides.warnings ?? [],
    doNotApplyAutomatically: true,
  };
}

function addEntries(
  recommendationType: string,
  confirmed: number,
  rolledBack: number,
  inconclusive: number = 0,
) {
  for (let i = 0; i < confirmed; i++) {
    rememberVoicePatchHistory({
      patchId: `${recommendationType}-ok-${i}`,
      recommendationType,
      outcome: "confirmed",
      reason: "patch_improved_runtime",
      confidence: "high",
      appliedAtMs: Date.now() - 60000,
      finalizedAtMs: Date.now(),
      beforeMetrics: sampleMetrics,
      afterMetrics: sampleMetrics,
    });
  }
  for (let i = 0; i < rolledBack; i++) {
    rememberVoicePatchHistory({
      patchId: `${recommendationType}-fail-${i}`,
      recommendationType,
      outcome: "rolled_back",
      reason: "patch_caused_regression",
      confidence: "high",
      appliedAtMs: Date.now() - 60000,
      finalizedAtMs: Date.now(),
      beforeMetrics: sampleMetrics,
      afterMetrics: sampleMetrics,
    });
  }
  for (let i = 0; i < inconclusive; i++) {
    rememberVoicePatchHistory({
      patchId: `${recommendationType}-mix-${i}`,
      recommendationType,
      outcome: "inconclusive",
      reason: "mixed_post_apply_signals",
      confidence: "medium",
      appliedAtMs: Date.now() - 60000,
      finalizedAtMs: Date.now(),
      beforeMetrics: sampleMetrics,
      afterMetrics: sampleMetrics,
    });
  }
}

// ============================================================================
// TEST 1 — boosts_confidence_for_supported_patch
// ============================================================================

function testBoostsConfidenceForSupportedPatch() {
  resetVoicePatchHistory();

  // Create supported history: 6 confirmed, 0 rolled_back
  addEntries("prefer_fast_voice_for_short_replies", 6, 0);

  const rec = makeRecommendation({
    recommendationType: "prefer_fast_voice_for_short_replies",
    confidence: "medium",
  });

  const shaped = shapeVoiceRecommendationWithTrust(rec);

  if (shaped.shapedConfidence !== "high") {
    throw new Error(`Expected high shaped confidence, got ${shaped.shapedConfidence}`);
  }
  if (shaped.originalConfidence !== "medium") {
    throw new Error(`Original confidence should be preserved, got ${shaped.originalConfidence}`);
  }

  console.log("✅ testBoostsConfidenceForSupportedPatch passed");
}

// ============================================================================
// TEST 2 — reduces_confidence_for_risky_patch
// ============================================================================

function testReducesConfidenceForRiskyPatch() {
  resetVoicePatchHistory();

  // Create risky history: 0 confirmed, 5 rolled_back
  addEntries("lower_interruption_guard_sensitivity", 0, 5);

  const rec = makeRecommendation({
    recommendationType: "lower_interruption_guard_sensitivity",
    confidence: "high",
  });

  const shaped = shapeVoiceRecommendationWithTrust(rec);

  if (shaped.shapedConfidence !== "medium") {
    throw new Error(`Expected medium shaped confidence, got ${shaped.shapedConfidence}`);
  }
  if (shaped.originalConfidence !== "high") {
    throw new Error(`Original confidence should be preserved, got ${shaped.originalConfidence}`);
  }

  console.log("✅ testReducesConfidenceForRiskyPatch passed");
}

// ============================================================================
// TEST 3 — keeps_confidence_for_uncertain_patch
// ============================================================================

function testKeepsConfidenceForUncertainPatch() {
  resetVoicePatchHistory();

  // Mixed history: 3 confirmed, 2 rolled_back → uncertain
  addEntries("prefer_quality_voice_for_stable_sessions", 3, 2);

  const rec = makeRecommendation({
    recommendationType: "prefer_quality_voice_for_stable_sessions",
    confidence: "medium",
  });

  const shaped = shapeVoiceRecommendationWithTrust(rec);

  if (shaped.shapedConfidence !== "medium") {
    throw new Error(`Expected medium shaped confidence for uncertain, got ${shaped.shapedConfidence}`);
  }
  if (shaped.originalConfidence !== "medium") {
    throw new Error(`Original confidence should be unchanged, got ${shaped.originalConfidence}`);
  }

  console.log("✅ testKeepsConfidenceForUncertainPatch passed");
}

// ============================================================================
// TEST 4 — assigns_high_priority_for_supported
// ============================================================================

function testAssignsHighPriorityForSupported() {
  resetVoicePatchHistory();

  addEntries("prefer_fast_voice_for_short_replies", 6, 0);

  const rec = makeRecommendation({
    recommendationType: "prefer_fast_voice_for_short_replies",
  });

  const shaped = shapeVoiceRecommendationWithTrust(rec);

  if (shaped.priority !== "high") {
    throw new Error(`Expected high priority, got ${shaped.priority}`);
  }

  console.log("✅ testAssignsHighPriorityForSupported passed");
}

// ============================================================================
// TEST 5 — assigns_low_priority_for_risky
// ============================================================================

function testAssignsLowPriorityForRisky() {
  resetVoicePatchHistory();

  addEntries("raise_interruption_guard_sensitivity", 0, 4);

  const rec = makeRecommendation({
    recommendationType: "raise_interruption_guard_sensitivity",
  });

  const shaped = shapeVoiceRecommendationWithTrust(rec);

  if (shaped.priority !== "low") {
    throw new Error(`Expected low priority, got ${shaped.priority}`);
  }

  console.log("✅ testAssignsLowPriorityForRisky passed");
}

// ============================================================================
// TEST 6 — assigns_normal_priority_for_uncertain
// ============================================================================

function testAssignsNormalPriorityForUncertain() {
  resetVoicePatchHistory();

  addEntries("prefer_quality_voice_for_stable_sessions", 3, 2);

  const rec = makeRecommendation({
    recommendationType: "prefer_quality_voice_for_stable_sessions",
  });

  const shaped = shapeVoiceRecommendationWithTrust(rec);

  if (shaped.priority !== "normal") {
    throw new Error(`Expected normal priority, got ${shaped.priority}`);
  }

  console.log("✅ testAssignsNormalPriorityForUncertain passed");
}

// ============================================================================
// TEST 7 — never_changes_recommendation_type
// ============================================================================

function testNeverChangesRecommendationType() {
  resetVoicePatchHistory();

  addEntries("prefer_fast_voice_for_short_replies", 5, 0);

  const rec = makeRecommendation({
    recommendationType: "prefer_fast_voice_for_short_replies",
  });

  const shaped = shapeVoiceRecommendationWithTrust(rec);

  if (shaped.originalType !== "prefer_fast_voice_for_short_replies") {
    throw new Error(`Recommendation type should not change, got ${shaped.originalType}`);
  }

  console.log("✅ testNeverChangesRecommendationType passed");
}

// ============================================================================
// TEST 8 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  resetVoicePatchHistory();

  addEntries("prefer_fast_voice_for_short_replies", 5, 0);

  const rec = makeRecommendation({
    recommendationType: "prefer_fast_voice_for_short_replies",
    confidence: "medium",
  });

  const shaped1 = shapeVoiceRecommendationWithTrust(rec);
  const shaped2 = shapeVoiceRecommendationWithTrust(rec);

  // Strip generatedAtMs for comparison
  const s1 = { ...shaped1, generatedAtMs: 0 };
  const s2 = { ...shaped2, generatedAtMs: 0 };

  if (JSON.stringify(s1) !== JSON.stringify(s2)) {
    throw new Error("Shaped recommendation should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 9 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  resetVoicePatchHistory();

  // Supported → should have reasons
  addEntries("prefer_fast_voice_for_short_replies", 5, 0);
  const supported = shapeVoiceRecommendationWithTrust(
    makeRecommendation({ recommendationType: "prefer_fast_voice_for_short_replies" }),
  );

  if (supported.reasons.length === 0) {
    throw new Error("Supported recommendation should have reasons");
  }
  if (!supported.reasons.includes("historical_support_strengthens_recommendation")) {
    throw new Error("Missing historical_support_strengthens_recommendation reason");
  }

  // Risky → should have warnings
  addEntries("lower_interruption_guard_sensitivity", 0, 4);
  const risky = shapeVoiceRecommendationWithTrust(
    makeRecommendation({ recommendationType: "lower_interruption_guard_sensitivity" }),
  );

  if (risky.warnings.length === 0) {
    throw new Error("Risky recommendation should have warnings");
  }
  if (!risky.warnings.includes("historical_risk_reduces_recommendation_confidence")) {
    throw new Error("Missing historical_risk_reduces_recommendation_confidence warning");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 10 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  resetVoicePatchHistory();

  addEntries("prefer_fast_voice_for_short_replies", 5, 0);

  const rec = makeRecommendation({
    recommendationType: "prefer_fast_voice_for_short_replies",
    confidence: "medium",
  });

  const shaped = shapeVoiceRecommendationWithTrust(rec);
  const formatted = formatVoiceShapedRecommendation(shaped);

  if (!formatted.includes("🧭 Voice Trust-Aware Recommendation")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("original confidence")) {
    throw new Error("Missing original confidence in formatted output");
  }
  if (!formatted.includes("shaped confidence")) {
    throw new Error("Missing shaped confidence in formatted output");
  }
  if (!formatted.includes("priority")) {
    throw new Error("Missing priority in formatted output");
  }
  if (!formatted.includes("trust score")) {
    throw new Error("Missing trust score in formatted output");
  }
  if (!formatted.includes("bias status")) {
    throw new Error("Missing bias status in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 11 — preserves_high_confidence_when_supported
// ============================================================================

function testPreservesHighConfidenceWhenSupported() {
  resetVoicePatchHistory();

  addEntries("allow_more_voice_when_success_rate_is_high", 6, 0);

  const rec = makeRecommendation({
    recommendationType: "allow_more_voice_when_success_rate_is_high",
    confidence: "high",
  });

  const shaped = shapeVoiceRecommendationWithTrust(rec);

  // High confidence should stay high for supported patches
  if (shaped.shapedConfidence !== "high") {
    throw new Error(`Expected high confidence to stay high, got ${shaped.shapedConfidence}`);
  }

  console.log("✅ testPreservesHighConfidenceWhenSupported passed");
}

// ============================================================================
// TEST 12 — preserves_low_confidence_when_risky
// ============================================================================

function testPreservesLowConfidenceWhenRisky() {
  resetVoicePatchHistory();

  addEntries("raise_interruption_guard_sensitivity", 0, 5);

  const rec = makeRecommendation({
    recommendationType: "raise_interruption_guard_sensitivity",
    confidence: "low",
  });

  const shaped = shapeVoiceRecommendationWithTrust(rec);

  // Low confidence should stay low for risky patches
  if (shaped.shapedConfidence !== "low") {
    throw new Error(`Expected low confidence to stay low, got ${shaped.shapedConfidence}`);
  }

  console.log("✅ testPreservesLowConfidenceWhenRisky passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Trust-Aware Recommendation Shaping Tests ===\n");

try {
  testBoostsConfidenceForSupportedPatch();
  testReducesConfidenceForRiskyPatch();
  testKeepsConfidenceForUncertainPatch();
  testAssignsHighPriorityForSupported();
  testAssignsLowPriorityForRisky();
  testAssignsNormalPriorityForUncertain();
  testNeverChangesRecommendationType();
  testReturnsDeterministicOutput();
  testIncludesReasonsAndWarnings();
  testFormatsOutputCorrectly();
  testPreservesHighConfidenceWhenSupported();
  testPreservesLowConfidenceWhenRisky();

  console.log("\n✅ All voice trust-aware recommendation shaping tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
