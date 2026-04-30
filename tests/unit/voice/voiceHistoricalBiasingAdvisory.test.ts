import {
  buildVoiceHistoricalBiasAdvisory,
  formatVoiceHistoricalBiasAdvisory,
  type VoiceHistoricalBiasAdvisory,
} from "../../../src/telegram/voiceHistoricalBiasingAdvisory.js";
import type { VoicePolicyRecommendation } from "../../../src/telegram/voiceAdaptivePolicyRecommendations.js";
import {
  rememberVoicePatchHistory,
  resetVoicePatchHistory,
  type VoicePatchHistoryEntry,
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
    confidence: overrides.confidence ?? "high",
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
// TEST 1 — builds_supported_bias_for_trusted_patch_family
// ============================================================================

function testBuildsSupportedBiasForTrustedPatchFamily() {
  resetVoicePatchHistory();

  addEntries("prefer_fast_voice_for_short_replies", 6, 0);

  const rec = makeRecommendation({ recommendationType: "prefer_fast_voice_for_short_replies" });
  const advisory = buildVoiceHistoricalBiasAdvisory(rec);

  if (advisory.biasStatus !== "historically_supported") {
    throw new Error(`Expected historically_supported, got ${advisory.biasStatus}`);
  }
  if (advisory.advisoryWeight !== "positive") {
    throw new Error(`Expected positive advisory weight, got ${advisory.advisoryWeight}`);
  }
  if (!advisory.summary.includes("historically trusted")) {
    throw new Error("Summary should mention historically trusted");
  }

  console.log("✅ testBuildsSupportedBiasForTrustedPatchFamily passed");
}

// ============================================================================
// TEST 2 — builds_risky_bias_for_risky_patch_family
// ============================================================================

function testBuildsRiskyBiasForRiskyPatchFamily() {
  resetVoicePatchHistory();

  addEntries("lower_interruption_guard_sensitivity", 0, 5);

  const rec = makeRecommendation({ recommendationType: "lower_interruption_guard_sensitivity" });
  const advisory = buildVoiceHistoricalBiasAdvisory(rec);

  if (advisory.biasStatus !== "historically_risky") {
    throw new Error(`Expected historically_risky, got ${advisory.biasStatus}`);
  }
  if (advisory.advisoryWeight !== "negative") {
    throw new Error(`Expected negative advisory weight, got ${advisory.advisoryWeight}`);
  }
  if (!advisory.summary.includes("rollback-heavy")) {
    throw new Error("Summary should mention rollback-heavy");
  }

  console.log("✅ testBuildsRiskyBiasForRiskyPatchFamily passed");
}

// ============================================================================
// TEST 3 — builds_uncertain_bias_for_neutral_patch_family
// ============================================================================

function testBuildsUncertainBiasForNeutralPatchFamily() {
  resetVoicePatchHistory();

  // Mixed history: 3 confirmed, 2 rolled_back → trust score = (3*1.0 + 0)/5 - (2/5)*0.6 = 0.6 - 0.24 = 0.36
  // This is between 0.35 and 0.70 → neutral status → historically_uncertain
  addEntries("prefer_quality_voice_for_stable_sessions", 3, 2);

  const rec = makeRecommendation({ recommendationType: "prefer_quality_voice_for_stable_sessions" });
  const advisory = buildVoiceHistoricalBiasAdvisory(rec);

  if (advisory.biasStatus !== "historically_uncertain") {
    throw new Error(`Expected historically_uncertain, got ${advisory.biasStatus}`);
  }
  if (advisory.advisoryWeight !== "neutral") {
    throw new Error(`Expected neutral advisory weight, got ${advisory.advisoryWeight}`);
  }

  console.log("✅ testBuildsUncertainBiasForNeutralPatchFamily passed");
}

// ============================================================================
// TEST 4 — propagates_trust_score_and_confidence
// ============================================================================

function testPropagatesTrustScoreAndConfidence() {
  resetVoicePatchHistory();

  addEntries("allow_more_voice_when_success_rate_is_high", 5, 0);

  const rec = makeRecommendation({ recommendationType: "allow_more_voice_when_success_rate_is_high" });
  const advisory = buildVoiceHistoricalBiasAdvisory(rec);

  if (advisory.trustScore < 0.90) {
    throw new Error(`Expected high trust score, got ${advisory.trustScore}`);
  }
  if (advisory.confidence !== "high") {
    throw new Error(`Expected high confidence, got ${advisory.confidence}`);
  }

  console.log("✅ testPropagatesTrustScoreAndConfidence passed");
}

// ============================================================================
// TEST 5 — returns_neutral_bias_when_no_history_exists
// ============================================================================

function testReturnsNeutralBiasWhenNoHistoryExists() {
  resetVoicePatchHistory();

  const rec = makeRecommendation({ recommendationType: "nonexistent_patch_type" });
  const advisory = buildVoiceHistoricalBiasAdvisory(rec);

  if (advisory.biasStatus !== "historically_uncertain") {
    throw new Error(`Expected historically_uncertain, got ${advisory.biasStatus}`);
  }
  if (advisory.advisoryWeight !== "neutral") {
    throw new Error(`Expected neutral advisory weight, got ${advisory.advisoryWeight}`);
  }
  if (advisory.trustScore !== 0) {
    throw new Error(`Expected trust score 0, got ${advisory.trustScore}`);
  }
  if (!advisory.summary.includes("no historical support")) {
    throw new Error("Summary should mention no historical support");
  }

  console.log("✅ testReturnsNeutralBiasWhenNoHistoryExists passed");
}

// ============================================================================
// TEST 6 — formats_bias_advisory_for_human_reading
// ============================================================================

function testFormatsBiasAdvisoryForHumanReading() {
  resetVoicePatchHistory();

  addEntries("prefer_fast_voice_for_short_replies", 5, 0);

  const rec = makeRecommendation({ recommendationType: "prefer_fast_voice_for_short_replies" });
  const advisory = buildVoiceHistoricalBiasAdvisory(rec);
  const formatted = formatVoiceHistoricalBiasAdvisory(advisory);

  if (!formatted.includes("🧭 Voice Historical Bias Advisory")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("historically_supported")) {
    throw new Error("Missing bias status in formatted output");
  }
  if (!formatted.includes("positive")) {
    throw new Error("Missing advisory weight in formatted output");
  }
  if (!formatted.includes("trust score")) {
    throw new Error("Missing trust score in formatted output");
  }

  console.log("✅ testFormatsBiasAdvisoryForHumanReading passed");
}

// ============================================================================
// TEST 7 — returns_deterministic_bias_output
// ============================================================================

function testReturnsDeterministicBiasOutput() {
  resetVoicePatchHistory();

  addEntries("prefer_fast_voice_for_short_replies", 5, 0);

  const rec = makeRecommendation({ recommendationType: "prefer_fast_voice_for_short_replies" });

  const advisory1 = buildVoiceHistoricalBiasAdvisory(rec);
  const advisory2 = buildVoiceHistoricalBiasAdvisory(rec);

  // Strip generatedAtMs for comparison
  const a1 = { ...advisory1, generatedAtMs: 0 };
  const a2 = { ...advisory2, generatedAtMs: 0 };

  if (JSON.stringify(a1) !== JSON.stringify(a2)) {
    throw new Error("Bias advisory should be deterministic");
  }

  console.log("✅ testReturnsDeterministicBiasOutput passed");
}

// ============================================================================
// TEST 8 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  resetVoicePatchHistory();

  // Trusted patch → should have reasons
  addEntries("prefer_fast_voice_for_short_replies", 5, 0);
  const supportedAdvisory = buildVoiceHistoricalBiasAdvisory(
    makeRecommendation({ recommendationType: "prefer_fast_voice_for_short_replies" }),
  );

  if (supportedAdvisory.reasons.length === 0) {
    throw new Error("Supported advisory should have reasons");
  }

  // Risky patch → should have warnings
  addEntries("raise_interruption_guard_sensitivity", 0, 4);
  const riskyAdvisory = buildVoiceHistoricalBiasAdvisory(
    makeRecommendation({ recommendationType: "raise_interruption_guard_sensitivity" }),
  );

  if (riskyAdvisory.warnings.length === 0) {
    throw new Error("Risky advisory should have warnings");
  }
  if (!riskyAdvisory.warnings.includes("historical_bias_is_negative_for_this_family")) {
    throw new Error("Missing historical_bias_is_negative warning");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 9 — works_with_mixed_history_patch_family
// ============================================================================

function testWorksWithMixedHistoryPatchFamily() {
  resetVoicePatchHistory();

  // Mixed: 4 confirmed, 2 rolled_back → trust score = (4*1.0)/6 - (2/6)*0.6 = 0.667 - 0.2 = 0.467
  // This is between 0.35 and 0.70 → neutral status → historically_uncertain
  addEntries("prefer_quality_voice_for_stable_sessions", 4, 2);

  const rec = makeRecommendation({ recommendationType: "prefer_quality_voice_for_stable_sessions" });
  const advisory = buildVoiceHistoricalBiasAdvisory(rec);

  // Should be uncertain since trust score will be moderate
  if (advisory.biasStatus !== "historically_uncertain") {
    throw new Error(`Expected historically_uncertain for mixed history, got ${advisory.biasStatus}`);
  }
  if (advisory.advisoryWeight !== "neutral") {
    throw new Error(`Expected neutral weight for mixed history, got ${advisory.advisoryWeight}`);
  }
  if (advisory.trustScore > 0.8 || advisory.trustScore < 0.2) {
    throw new Error(`Expected moderate trust score for mixed history, got ${advisory.trustScore}`);
  }

  console.log("✅ testWorksWithMixedHistoryPatchFamily passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_runtime_decisions
// ============================================================================

function testDoesNotMutateRuntimeDecisions() {
  resetVoicePatchHistory();

  addEntries("prefer_fast_voice_for_short_replies", 5, 0);

  const rec = makeRecommendation({ recommendationType: "prefer_fast_voice_for_short_replies" });

  // Store original recommendation properties
  const originalConfidence = rec.confidence;
  const originalDoNotApply = rec.doNotApplyAutomatically;

  // Build advisory
  const advisory = buildVoiceHistoricalBiasAdvisory(rec);

  // Recommendation should be unchanged
  if (rec.confidence !== originalConfidence) {
    throw new Error("Advisory should not mutate recommendation confidence");
  }
  if (rec.doNotApplyAutomatically !== originalDoNotApply) {
    throw new Error("Advisory should not mutate doNotApplyAutomatically");
  }

  // Advisory itself should have doNotApplyAutomatically behavior (advisory only)
  // The advisory doesn't have doNotApplyAutomatically field, but it's advisory-only by design

  console.log("✅ testDoesNotMutateRuntimeDecisions passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Historical Biasing Advisory Tests ===\n");

try {
  testBuildsSupportedBiasForTrustedPatchFamily();
  testBuildsRiskyBiasForRiskyPatchFamily();
  testBuildsUncertainBiasForNeutralPatchFamily();
  testPropagatesTrustScoreAndConfidence();
  testReturnsNeutralBiasWhenNoHistoryExists();
  testFormatsBiasAdvisoryForHumanReading();
  testReturnsDeterministicBiasOutput();
  testIncludesReasonsAndWarnings();
  testWorksWithMixedHistoryPatchFamily();
  testDoesNotMutateRuntimeDecisions();

  console.log("\n✅ All voice historical biasing advisory tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
