import {
  evaluateVoiceGovernedApply,
  formatVoiceGovernedApplyResult,
  type EvaluateVoiceGovernedApplyInput,
  type VoiceGovernedApplyResult,
} from "../../../src/telegram/voiceGovernedApplyGate.js";
import type { VoicePolicyRecommendation } from "../../../src/telegram/voiceAdaptivePolicyRecommendations.js";

// ============================================================================
// Helpers
// ============================================================================

function makeRecommendation(overrides: Partial<VoicePolicyRecommendation>): VoicePolicyRecommendation {
  return {
    recommendationType: overrides.recommendationType ?? "prefer_fast_voice_for_short_replies",
    confidence: overrides.confidence ?? "high",
    summary: overrides.summary ?? "Fast voice is better for short replies.",
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
    reasons: overrides.reasons ?? ["fast_voice_significantly_lower_latency"],
    warnings: overrides.warnings ?? [],
    doNotApplyAutomatically: true,
  };
}

function makeSummary(overrides: Partial<EvaluateVoiceGovernedApplyInput["summary"]>): EvaluateVoiceGovernedApplyInput["summary"] {
  return {
    totalSignals: overrides.totalSignals ?? 50,
    voiceSuccessRate: overrides.voiceSuccessRate ?? 85,
    fallbackRate: overrides.fallbackRate ?? 8,
    interruptionBlockRate: overrides.interruptionBlockRate ?? 5,
    avgQualityScore: overrides.avgQualityScore ?? 75,
  };
}

function makeInput(overrides: Partial<EvaluateVoiceGovernedApplyInput>): EvaluateVoiceGovernedApplyInput {
  return {
    recommendation: overrides.recommendation ?? makeRecommendation({}),
    summary: overrides.summary ?? makeSummary({}),
    currentInstabilityLevel: overrides.currentInstabilityLevel ?? "low",
    recentRecommendationFlaps: overrides.recentRecommendationFlaps ?? 0,
  };
}

// ============================================================================
// TEST 1 — holds_when_signal_window_is_too_small
// ============================================================================

function testHoldsWhenSignalWindowTooSmall() {
  const input = makeInput({
    summary: makeSummary({ totalSignals: 10 }),
  });

  const result = evaluateVoiceGovernedApply(input);

  if (result.applyDecision !== "hold") {
    throw new Error(`Expected hold for small signal window, got ${result.applyDecision}`);
  }
  if (result.reason !== "insufficient_evidence_window") {
    throw new Error(`Expected insufficient_evidence_window reason, got ${result.reason}`);
  }
  if (!result.blockers.includes("not_enough_voice_turns")) {
    throw new Error("Missing not_enough_voice_turns blocker");
  }

  console.log("✅ testHoldsWhenSignalWindowTooSmall passed");
}

// ============================================================================
// TEST 2 — holds_when_recommendation_confidence_is_low
// ============================================================================

function testHoldsWhenRecommendationConfidenceLow() {
  const input = makeInput({
    recommendation: makeRecommendation({ confidence: "low" }),
    summary: makeSummary({ totalSignals: 50 }),
  });

  const result = evaluateVoiceGovernedApply(input);

  if (result.applyDecision !== "hold") {
    throw new Error(`Expected hold for low confidence, got ${result.applyDecision}`);
  }
  if (result.reason !== "recommendation_confidence_too_low") {
    throw new Error(`Expected recommendation_confidence_too_low reason, got ${result.reason}`);
  }
  if (!result.blockers.includes("weak_policy_signal")) {
    throw new Error("Missing weak_policy_signal blocker");
  }

  console.log("✅ testHoldsWhenRecommendationConfidenceLow passed");
}

// ============================================================================
// TEST 3 — denies_when_voice_runtime_is_unstable
// ============================================================================

function testDeniesWhenVoiceRuntimeUnstable() {
  const input = makeInput({
    summary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 50, // below 55%
      fallbackRate: 40, // above 35%
    }),
    recommendation: makeRecommendation({ confidence: "high" }),
  });

  const result = evaluateVoiceGovernedApply(input);

  if (result.applyDecision !== "deny") {
    throw new Error(`Expected deny for unstable runtime, got ${result.applyDecision}`);
  }
  if (result.reason !== "voice_runtime_unstable") {
    throw new Error(`Expected voice_runtime_unstable reason, got ${result.reason}`);
  }
  if (result.confidence !== "high") {
    throw new Error(`Expected high confidence for deny, got ${result.confidence}`);
  }
  if (!result.blockers.includes("delivery_instability_detected")) {
    throw new Error("Missing delivery_instability_detected blocker");
  }
  if (!result.warnings.includes("apply_under_instability_is_blocked")) {
    throw new Error("Missing apply_under_instability_is_blocked warning");
  }

  console.log("✅ testDeniesWhenVoiceRuntimeUnstable passed");
}

// ============================================================================
// TEST 4 — holds_when_policy_flapping_detected
// ============================================================================

function testHoldsWhenPolicyFlappingDetected() {
  const input = makeInput({
    recentRecommendationFlaps: 3,
    summary: makeSummary({ totalSignals: 50 }),
    recommendation: makeRecommendation({ confidence: "high" }),
  });

  const result = evaluateVoiceGovernedApply(input);

  if (result.applyDecision !== "hold") {
    throw new Error(`Expected hold for policy flapping, got ${result.applyDecision}`);
  }
  if (result.reason !== "policy_flapping_detected") {
    throw new Error(`Expected policy_flapping_detected reason, got ${result.reason}`);
  }
  if (!result.blockers.includes("recommendation_instability")) {
    throw new Error("Missing recommendation_instability blocker");
  }
  if (!result.warnings.includes("wait_for_stabilization_window")) {
    throw new Error("Missing wait_for_stabilization_window warning");
  }

  console.log("✅ testHoldsWhenPolicyFlappingDetected passed");
}

// ============================================================================
// TEST 5 — allows_apply_when_evidence_is_strong_and_runtime_stable
// ============================================================================

function testAllowsApplyWhenEvidenceStrongAndStable() {
  const input = makeInput({
    summary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 90,
      fallbackRate: 5,
    }),
    recommendation: makeRecommendation({ confidence: "high" }),
    currentInstabilityLevel: "low",
    recentRecommendationFlaps: 0,
  });

  const result = evaluateVoiceGovernedApply(input);

  if (result.applyDecision !== "allow_apply") {
    throw new Error(`Expected allow_apply, got ${result.applyDecision}`);
  }
  if (result.reason !== "sufficient_evidence_and_stable_runtime") {
    throw new Error(`Expected sufficient_evidence_and_stable_runtime reason, got ${result.reason}`);
  }
  if (result.confidence !== "high") {
    throw new Error(`Expected high confidence for allow, got ${result.confidence}`);
  }
  if (result.blockers.length !== 0) {
    throw new Error(`Expected no blockers, got ${result.blockers.join(", ")}`);
  }

  console.log("✅ testAllowsApplyWhenEvidenceStrongAndStable passed");
}

// ============================================================================
// TEST 6 — always_requires_manual_review_only
// ============================================================================

function testAlwaysRequiresManualReviewOnly() {
  const inputs = [
    makeInput({ summary: makeSummary({ totalSignals: 10 }) }),
    makeInput({ summary: makeSummary({ totalSignals: 50, voiceSuccessRate: 50, fallbackRate: 40 }), recommendation: makeRecommendation({ confidence: "high" }) }),
    makeInput({ recommendation: makeRecommendation({ confidence: "low" }) }),
    makeInput({ recentRecommendationFlaps: 3 }),
    makeInput({ summary: makeSummary({ totalSignals: 50, voiceSuccessRate: 90 }), recommendation: makeRecommendation({ confidence: "high" }) }),
  ];

  for (const input of inputs) {
    const result = evaluateVoiceGovernedApply(input);
    if (result.safeApplyMode !== "manual_review_only") {
      throw new Error(`safeApplyMode must always be manual_review_only, got ${result.safeApplyMode} for ${result.applyDecision}`);
    }
  }

  console.log("✅ testAlwaysRequiresManualReviewOnly passed");
}

// ============================================================================
// TEST 7 — never_returns_auto_apply_mode
// ============================================================================

function testNeverReturnsAutoApplyMode() {
  const input = makeInput({
    summary: makeSummary({ totalSignals: 100, voiceSuccessRate: 95, fallbackRate: 2 }),
    recommendation: makeRecommendation({ confidence: "high" }),
  });

  const result = evaluateVoiceGovernedApply(input);

  // safeApplyMode must be manual_review_only — never auto
  if ((result.safeApplyMode as string) !== "manual_review_only") {
    throw new Error(`safeApplyMode should never be anything other than manual_review_only, got ${result.safeApplyMode}`);
  }

  console.log("✅ testNeverReturnsAutoApplyMode passed");
}

// ============================================================================
// TEST 8 — returns_structured_blockers_and_warnings
// ============================================================================

function testReturnsStructuredBlockersAndWarnings() {
  const input = makeInput({
    summary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 50,
      fallbackRate: 40,
    }),
    recommendation: makeRecommendation({ confidence: "high" }),
  });

  const result = evaluateVoiceGovernedApply(input);

  // Must have structured blockers array
  if (!Array.isArray(result.blockers)) {
    throw new Error("blockers must be an array");
  }
  if (result.blockers.length === 0) {
    throw new Error("Expected blockers for unstable runtime");
  }

  // Must have structured warnings array
  if (!Array.isArray(result.warnings)) {
    throw new Error("warnings must be an array");
  }
  if (result.warnings.length === 0) {
    throw new Error("Expected warnings for unstable runtime");
  }

  // Check specific content
  if (!result.blockers.includes("delivery_instability_detected")) {
    throw new Error("Missing expected blocker");
  }
  if (!result.warnings.includes("apply_under_instability_is_blocked")) {
    throw new Error("Missing expected warning");
  }

  console.log("✅ testReturnsStructuredBlockersAndWarnings passed");
}

// ============================================================================
// TEST 9 — high_system_instability_causes_hold
// ============================================================================

function testHighSystemInstabilityCausesHold() {
  const input = makeInput({
    currentInstabilityLevel: "high",
    summary: makeSummary({ totalSignals: 50, voiceSuccessRate: 85, fallbackRate: 8 }),
    recommendation: makeRecommendation({ confidence: "high" }),
  });

  const result = evaluateVoiceGovernedApply(input);

  if (result.applyDecision !== "hold") {
    throw new Error(`Expected hold for high instability, got ${result.applyDecision}`);
  }
  if (!result.blockers.includes("system_instability_high")) {
    throw new Error("Missing system_instability_high blocker");
  }
  if (!result.warnings.includes("runtime_too_unstable_for_policy_change")) {
    throw new Error("Missing runtime_too_unstable_for_policy_change warning");
  }

  console.log("✅ testHighSystemInstabilityCausesHold passed");
}

// ============================================================================
// TEST 10 — formatVoiceGovernedApplyResult produces readable output
// ============================================================================

function testFormatGovernedApplyResult() {
  const result: VoiceGovernedApplyResult = {
    applyDecision: "allow_apply",
    reason: "sufficient_evidence_and_stable_runtime",
    confidence: "high",
    blockers: [],
    warnings: ["manual_review_required_before_any_policy_change"],
    safeApplyMode: "manual_review_only",
    generatedAtMs: Date.now(),
  };

  const formatted = formatVoiceGovernedApplyResult("prefer_fast_voice_for_short_replies", result);

  if (!formatted.includes("allow_apply")) {
    throw new Error("Formatted output must include apply decision");
  }
  if (!formatted.includes("manual_review_only")) {
    throw new Error("Formatted output must include safe apply mode");
  }
  if (!formatted.includes("sufficient_evidence_and_stable_runtime")) {
    throw new Error("Formatted output must include reason");
  }

  console.log("✅ testFormatGovernedApplyResult passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Governed Apply Gate Tests ===\n");

try {
  testHoldsWhenSignalWindowTooSmall();
  testHoldsWhenRecommendationConfidenceLow();
  testDeniesWhenVoiceRuntimeUnstable();
  testHoldsWhenPolicyFlappingDetected();
  testAllowsApplyWhenEvidenceStrongAndStable();
  testAlwaysRequiresManualReviewOnly();
  testNeverReturnsAutoApplyMode();
  testReturnsStructuredBlockersAndWarnings();
  testHighSystemInstabilityCausesHold();
  testFormatGovernedApplyResult();

  console.log("\n✅ All voice governed apply gate tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
