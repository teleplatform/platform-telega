import {
  getVoicePatchTrustScore,
  getAllVoicePatchTrustScores,
  getVoiceHistoricalTrustSummary,
  formatVoicePatchTrustScore,
  formatVoiceHistoricalTrustSummary,
  type VoicePatchTrustScore,
} from "../../../src/telegram/voiceHistoricalTrustScoring.js";
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

function makeHistoryEntry(overrides: Partial<VoicePatchHistoryEntry>): VoicePatchHistoryEntry {
  return {
    patchId: overrides.patchId ?? "patch_fast_preference",
    rollbackId: overrides.rollbackId,
    recommendationType: overrides.recommendationType ?? "prefer_fast_voice_for_short_replies",
    outcome: overrides.outcome ?? "confirmed",
    reason: overrides.reason ?? "patch_improved_runtime",
    confidence: overrides.confidence ?? "high",
    appliedAtMs: overrides.appliedAtMs ?? Date.now() - 60000,
    finalizedAtMs: overrides.finalizedAtMs ?? Date.now(),
    beforeMetrics: overrides.beforeMetrics ?? sampleMetrics,
    afterMetrics: overrides.afterMetrics ?? sampleMetrics,
  };
}

function addEntries(
  recommendationType: string,
  confirmed: number,
  rolledBack: number,
  inconclusive: number = 0,
) {
  for (let i = 0; i < confirmed; i++) {
    rememberVoicePatchHistory(
      makeHistoryEntry({
        recommendationType,
        outcome: "confirmed",
        patchId: `${recommendationType}-ok-${i}`,
      }),
    );
  }
  for (let i = 0; i < rolledBack; i++) {
    rememberVoicePatchHistory(
      makeHistoryEntry({
        recommendationType,
        outcome: "rolled_back",
        patchId: `${recommendationType}-fail-${i}`,
      }),
    );
  }
  for (let i = 0; i < inconclusive; i++) {
    rememberVoicePatchHistory(
      makeHistoryEntry({
        recommendationType,
        outcome: "inconclusive",
        patchId: `${recommendationType}-mix-${i}`,
      }),
    );
  }
}

// ============================================================================
// TEST 1 — computes_trust_score_for_confirmed_patch_family
// ============================================================================

function testComputesTrustScoreForConfirmedPatchFamily() {
  resetVoicePatchHistory();

  addEntries("prefer_fast_voice_for_short_replies", 5, 0);

  const score = getVoicePatchTrustScore("prefer_fast_voice_for_short_replies");

  if (score.totalSamples !== 5) {
    throw new Error(`Expected 5 samples, got ${score.totalSamples}`);
  }
  if (score.confirmedCount !== 5) {
    throw new Error(`Expected 5 confirmed, got ${score.confirmedCount}`);
  }
  if (score.rolledBackCount !== 0) {
    throw new Error(`Expected 0 rolled back, got ${score.rolledBackCount}`);
  }

  // Formula: (5 * 1.0 + 0 * 0.4) / 5 - (0 / 5) * 0.6 = 1.0
  if (Math.abs(score.trustScore - 1.0) > 0.01) {
    throw new Error(`Expected trust score ~1.0, got ${score.trustScore}`);
  }

  console.log("✅ testComputesTrustScoreForConfirmedPatchFamily passed");
}

// ============================================================================
// TEST 2 — computes_low_trust_for_rolled_back_patch_family
// ============================================================================

function testComputesLowTrustForRolledBackPatchFamily() {
  resetVoicePatchHistory();

  addEntries("lower_interruption_guard_sensitivity", 1, 5);

  const score = getVoicePatchTrustScore("lower_interruption_guard_sensitivity");

  // Formula: (1 * 1.0 + 0 * 0.4) / 6 - (5 / 6) * 0.6 = 0.167 - 0.5 = -0.333 → 0
  if (score.trustScore > 0.2) {
    throw new Error(`Expected low trust score, got ${score.trustScore}`);
  }

  console.log("✅ testComputesLowTrustForRolledBackPatchFamily passed");
}

// ============================================================================
// TEST 3 — classifies_trusted_patch_type
// ============================================================================

function testClassifiesTrustedPatchType() {
  resetVoicePatchHistory();

  addEntries("prefer_quality_voice_for_stable_sessions", 4, 0);

  const score = getVoicePatchTrustScore("prefer_quality_voice_for_stable_sessions");

  if (score.status !== "trusted") {
    throw new Error(`Expected trusted status, got ${score.status}`);
  }
  if (score.trustScore < 0.70) {
    throw new Error(`Expected trust score >= 0.70, got ${score.trustScore}`);
  }

  console.log("✅ testClassifiesTrustedPatchType passed");
}

// ============================================================================
// TEST 4 — classifies_risky_patch_type
// ============================================================================

function testClassifiesRiskyPatchType() {
  resetVoicePatchHistory();

  addEntries("raise_interruption_guard_sensitivity", 0, 4);

  const score = getVoicePatchTrustScore("raise_interruption_guard_sensitivity");

  if (score.status !== "risky") {
    throw new Error(`Expected risky status, got ${score.status}`);
  }
  if (score.trustScore > 0.35) {
    throw new Error(`Expected trust score <= 0.35, got ${score.trustScore}`);
  }

  console.log("✅ testClassifiesRiskyPatchType passed");
}

// ============================================================================
// TEST 5 — classifies_neutral_when_sample_small
// ============================================================================

function testClassifiesNeutralWhenSampleSmall() {
  resetVoicePatchHistory();

  // Only 1 entry — not enough for trusted/risky classification
  addEntries("prefer_fast_voice_for_short_replies", 1, 0);

  const score = getVoicePatchTrustScore("prefer_fast_voice_for_short_replies");

  if (score.status !== "neutral") {
    throw new Error(`Expected neutral status for small sample, got ${score.status}`);
  }
  if (score.totalSamples !== 1) {
    throw new Error(`Expected 1 sample, got ${score.totalSamples}`);
  }

  console.log("✅ testClassifiesNeutralWhenSampleSmall passed");
}

// ============================================================================
// TEST 6 — assigns_high_medium_low_confidence_by_sample_size
// ============================================================================

function testAssignsConfidenceBySampleSize() {
  resetVoicePatchHistory();

  // Low confidence: < 3 samples
  addEntries("low_conf_test", 1, 0);
  const lowScore = getVoicePatchTrustScore("low_conf_test");
  if (lowScore.confidence !== "low") {
    throw new Error(`Expected low confidence, got ${lowScore.confidence}`);
  }

  // Medium confidence: 3-4 samples
  addEntries("medium_conf_test", 3, 0);
  const mediumScore = getVoicePatchTrustScore("medium_conf_test");
  if (mediumScore.confidence !== "medium") {
    throw new Error(`Expected medium confidence, got ${mediumScore.confidence}`);
  }

  // High confidence: >= 5 samples
  addEntries("high_conf_test", 5, 0);
  const highScore = getVoicePatchTrustScore("high_conf_test");
  if (highScore.confidence !== "high") {
    throw new Error(`Expected high confidence, got ${highScore.confidence}`);
  }

  console.log("✅ testAssignsConfidenceBySampleSize passed");
}

// ============================================================================
// TEST 7 — returns_zero_safe_score_when_no_history_exists
// ============================================================================

function testReturnsZeroSafeScoreWhenNoHistoryExists() {
  resetVoicePatchHistory();

  const score = getVoicePatchTrustScore("nonexistent_patch_type");

  if (score.trustScore !== 0) {
    throw new Error(`Expected trust score 0, got ${score.trustScore}`);
  }
  if (score.totalSamples !== 0) {
    throw new Error(`Expected 0 samples, got ${score.totalSamples}`);
  }
  if (score.status !== "neutral") {
    throw new Error(`Expected neutral status, got ${score.status}`);
  }
  if (score.confidence !== "low") {
    throw new Error(`Expected low confidence, got ${score.confidence}`);
  }
  if (!score.warnings.includes("no_history_available")) {
    throw new Error("Missing no_history_available warning");
  }

  console.log("✅ testReturnsZeroSafeScoreWhenNoHistoryExists passed");
}

// ============================================================================
// TEST 8 — returns_sorted_trust_scores_deterministically
// ============================================================================

function testReturnsSortedTrustScoresDeterministically() {
  resetVoicePatchHistory();

  // Add different patch types with different outcomes
  addEntries("prefer_fast_voice_for_short_replies", 5, 0); // High trust
  addEntries("lower_interruption_guard_sensitivity", 1, 3); // Lower trust
  addEntries("allow_more_voice_when_success_rate_is_high", 4, 0); // High trust

  const scores = getAllVoicePatchTrustScores();

  if (scores.length !== 3) {
    throw new Error(`Expected 3 scores, got ${scores.length}`);
  }

  // Should be sorted by trustScore descending
  for (let i = 0; i < scores.length - 1; i++) {
    if (scores[i].trustScore < scores[i + 1].trustScore) {
      throw new Error(
        `Scores not sorted descending: ${scores[i].trustScore} < ${scores[i + 1].trustScore}`,
      );
    }
  }

  // Deterministic: same input → same output
  const scores2 = getAllVoicePatchTrustScores();
  if (JSON.stringify(scores) !== JSON.stringify(scores2)) {
    throw new Error("Trust scores should be deterministic");
  }

  console.log("✅ testReturnsSortedTrustScoresDeterministically passed");
}

// ============================================================================
// TEST 9 — builds_historical_trust_summary
// ============================================================================

function testBuildsHistoricalTrustSummary() {
  resetVoicePatchHistory();

  // Trusted: high confirmation rate
  addEntries("prefer_fast_voice_for_short_replies", 6, 0);
  addEntries("allow_more_voice_when_success_rate_is_high", 5, 1);

  // Risky: high rollback rate
  addEntries("lower_interruption_guard_sensitivity", 0, 4);
  addEntries("raise_interruption_guard_sensitivity", 1, 4);

  // Neutral: mixed
  addEntries("prefer_quality_voice_for_stable_sessions", 3, 2);

  const summary = getVoiceHistoricalTrustSummary();

  if (summary.totalTrackedPatchTypes !== 5) {
    throw new Error(`Expected 5 tracked patch types, got ${summary.totalTrackedPatchTypes}`);
  }

  // Check trusted types
  if (!summary.trustedPatchTypes.includes("prefer_fast_voice_for_short_replies")) {
    throw new Error("Missing prefer_fast_voice in trusted types");
  }

  // Check risky types
  if (!summary.riskyPatchTypes.includes("lower_interruption_guard_sensitivity")) {
    throw new Error("Missing lower_interrupt in risky types");
  }

  // Top trusted scores should have max 3 entries
  if (summary.topTrustedScores.length > 3) {
    throw new Error(`Top trusted scores should be max 3, got ${summary.topTrustedScores.length}`);
  }

  // Top risky scores should have max 3 entries
  if (summary.topRiskyScores.length > 3) {
    throw new Error(`Top risky scores should be max 3, got ${summary.topRiskyScores.length}`);
  }

  console.log("✅ testBuildsHistoricalTrustSummary passed");
}

// ============================================================================
// TEST 10 — formatter_outputs_human_readable_trust_summary
// ============================================================================

function testFormatterOutputsHumanReadableTrustSummary() {
  resetVoicePatchHistory();

  addEntries("prefer_fast_voice_for_short_replies", 5, 0);
  addEntries("lower_interruption_guard_sensitivity", 0, 3);

  const summary = getVoiceHistoricalTrustSummary();
  const formatted = formatVoiceHistoricalTrustSummary(summary);

  if (!formatted.includes("🧠 Voice Historical Trust Summary")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("tracked patch types")) {
    throw new Error("Missing tracked patch types in formatted output");
  }
  if (!formatted.includes("trusted")) {
    throw new Error("Missing trusted section in formatted output");
  }
  if (!formatted.includes("risky")) {
    throw new Error("Missing risky section in formatted output");
  }

  console.log("✅ testFormatterOutputsHumanReadableTrustSummary passed");
}

// ============================================================================
// TEST 11 — includes_reasons_and_warnings_in_score
// ============================================================================

function testIncludesReasonsAndWarningsInScore() {
  resetVoicePatchHistory();

  // Trusted patch type
  addEntries("prefer_fast_voice_for_short_replies", 5, 0);
  const trustedScore = getVoicePatchTrustScore("prefer_fast_voice_for_short_replies");

  if (trustedScore.reasons.length === 0) {
    throw new Error("Trusted score should have reasons");
  }
  if (!trustedScore.reasons.includes("historically_confirmed_patch_family")) {
    throw new Error("Missing historically_confirmed_patch_family reason");
  }

  // Risky patch type
  addEntries("lower_interruption_guard_sensitivity", 0, 4);
  const riskyScore = getVoicePatchTrustScore("lower_interruption_guard_sensitivity");

  if (riskyScore.warnings.length === 0) {
    throw new Error("Risky score should have warnings");
  }
  if (!riskyScore.warnings.includes("patch_family_is_unstable")) {
    throw new Error("Missing patch_family_is_unstable warning");
  }
  if (!riskyScore.warnings.includes("rollback_history_present")) {
    throw new Error("Missing rollback_history_present warning");
  }

  console.log("✅ testIncludesReasonsAndWarningsInScore passed");
}

// ============================================================================
// TEST 12 — summary_handles_empty_history_safely
// ============================================================================

function testSummaryHandlesEmptyHistorySafely() {
  resetVoicePatchHistory();

  const summary = getVoiceHistoricalTrustSummary();

  if (summary.totalTrackedPatchTypes !== 0) {
    throw new Error(`Expected 0 tracked types, got ${summary.totalTrackedPatchTypes}`);
  }
  if (summary.trustedPatchTypes.length !== 0) {
    throw new Error("Expected empty trusted types");
  }
  if (summary.riskyPatchTypes.length !== 0) {
    throw new Error("Expected empty risky types");
  }
  if (summary.topTrustedScores.length !== 0) {
    throw new Error("Expected empty top trusted scores");
  }
  if (summary.topRiskyScores.length !== 0) {
    throw new Error("Expected empty top risky scores");
  }

  console.log("✅ testSummaryHandlesEmptyHistorySafely passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Historical Trust Scoring Tests ===\n");

try {
  testComputesTrustScoreForConfirmedPatchFamily();
  testComputesLowTrustForRolledBackPatchFamily();
  testClassifiesTrustedPatchType();
  testClassifiesRiskyPatchType();
  testClassifiesNeutralWhenSampleSmall();
  testAssignsConfidenceBySampleSize();
  testReturnsZeroSafeScoreWhenNoHistoryExists();
  testReturnsSortedTrustScoresDeterministically();
  testBuildsHistoricalTrustSummary();
  testFormatterOutputsHumanReadableTrustSummary();
  testIncludesReasonsAndWarningsInScore();
  testSummaryHandlesEmptyHistorySafely();

  console.log("\n✅ All voice historical trust scoring tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
