import {
  buildVoiceReviewPacket,
  formatVoiceReviewPacket,
  type BuildVoiceReviewPacketInput,
} from "../../../src/telegram/voiceReviewSurface.js";
import type { VoiceAdaptiveSummary } from "../../../src/telegram/voiceAdaptiveSignals.js";
import type { VoicePolicyRecommendation } from "../../../src/telegram/voiceAdaptivePolicyRecommendations.js";
import type { VoiceGovernedApplyResult } from "../../../src/telegram/voiceGovernedApplyGate.js";

// ============================================================================
// Helpers
// ============================================================================

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

function makeRecommendation(overrides: Partial<VoicePolicyRecommendation>): VoicePolicyRecommendation {
  return {
    recommendationType: overrides.recommendationType ?? "no_change",
    confidence: overrides.confidence ?? "medium",
    summary: overrides.summary ?? "No strong recommendation signals.",
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
    reasons: overrides.reasons ?? ["metrics_within_acceptable_ranges"],
    warnings: overrides.warnings ?? [],
    doNotApplyAutomatically: true,
  };
}

function makeGovernedApply(overrides: Partial<VoiceGovernedApplyResult>): VoiceGovernedApplyResult {
  return {
    applyDecision: overrides.applyDecision ?? "allow_apply",
    reason: overrides.reason ?? "sufficient_evidence_and_stable_runtime",
    confidence: overrides.confidence ?? "high",
    blockers: overrides.blockers ?? [],
    warnings: overrides.warnings ?? [],
    safeApplyMode: "manual_review_only",
    generatedAtMs: Date.now(),
  };
}

function makeInput(overrides: Partial<BuildVoiceReviewPacketInput>): BuildVoiceReviewPacketInput {
  return {
    summary: overrides.summary ?? makeSummary({}),
    recommendation: overrides.recommendation ?? makeRecommendation({}),
    governedApply: overrides.governedApply ?? makeGovernedApply({}),
  };
}

// ============================================================================
// TEST 1 — builds_healthy_status_when_runtime_is_strong
// ============================================================================

function testBuildsHealthyStatusWhenRuntimeStrong() {
  const input = makeInput({
    summary: makeSummary({
      totalSignals: 100,
      voiceSuccessRate: 92,
      fallbackRate: 3,
      avgQualityScore: 85,
    }),
    recommendation: makeRecommendation({
      recommendationType: "no_change",
      confidence: "high",
    }),
    governedApply: makeGovernedApply({
      applyDecision: "allow_apply",
      blockers: [],
      warnings: [],
    }),
  });

  const packet = buildVoiceReviewPacket(input);

  if (packet.status !== "healthy") {
    throw new Error(`Expected healthy status, got ${packet.status}`);
  }
  if (!packet.headline.includes("healthy")) {
    throw new Error(`Healthy headline should contain 'healthy', got: ${packet.headline}`);
  }

  console.log("✅ testBuildsHealthyStatusWhenRuntimeStrong passed");
}

// ============================================================================
// TEST 2 — builds_watch_status_when_recommendation_is_hold
// ============================================================================

function testBuildsWatchStatusWhenRecommendationHold() {
  const input = makeInput({
    summary: makeSummary({ totalSignals: 40 }),
    recommendation: makeRecommendation({
      recommendationType: "prefer_fast_voice_for_short_replies",
      confidence: "high",
      summary: "Fast voice is better for short replies.",
    }),
    governedApply: makeGovernedApply({
      applyDecision: "hold",
      reason: "insufficient_stability_window",
    }),
  });

  const packet = buildVoiceReviewPacket(input);

  if (packet.status !== "watch") {
    throw new Error(`Expected watch status, got ${packet.status}`);
  }
  if (packet.recommendation.type !== "prefer_fast_voice_for_short_replies") {
    throw new Error(`Expected recommendation type, got ${packet.recommendation.type}`);
  }
  if (packet.governance.applyDecision !== "hold") {
    throw new Error(`Expected hold governance decision, got ${packet.governance.applyDecision}`);
  }

  console.log("✅ testBuildsWatchStatusWhenRecommendationHold passed");
}

// ============================================================================
// TEST 3 — builds_degraded_status_when_fallback_is_high
// ============================================================================

function testBuildsDegradedStatusWhenFallbackHigh() {
  const input = makeInput({
    summary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 55,
      fallbackRate: 40,
      avgQualityScore: 45,
    }),
    recommendation: makeRecommendation({
      recommendationType: "reduce_voice_usage_when_fallback_spikes",
      confidence: "high",
    }),
    governedApply: makeGovernedApply({
      applyDecision: "hold",
      blockers: ["delivery_instability_detected"],
    }),
  });

  const packet = buildVoiceReviewPacket(input);

  if (packet.status !== "degraded") {
    throw new Error(`Expected degraded status, got ${packet.status}`);
  }
  if (packet.metrics.fallbackRate !== 40) {
    throw new Error(`Expected fallback rate 40, got ${packet.metrics.fallbackRate}`);
  }
  if (packet.blockers.length === 0) {
    throw new Error("Expected blockers for degraded status");
  }

  console.log("✅ testBuildsDegradedStatusWhenFallbackHigh passed");
}

// ============================================================================
// TEST 4 — builds_blocked_status_when_governed_apply_denies
// ============================================================================

function testBuildsBlockedStatusWhenGovernedApplyDenies() {
  const input = makeInput({
    summary: makeSummary({
      totalSignals: 50,
      voiceSuccessRate: 45,
      fallbackRate: 50,
    }),
    recommendation: makeRecommendation({
      recommendationType: "reduce_voice_usage_when_fallback_spikes",
    }),
    governedApply: makeGovernedApply({
      applyDecision: "deny",
      reason: "voice_runtime_unstable",
    }),
  });

  const packet = buildVoiceReviewPacket(input);

  if (packet.status !== "blocked") {
    throw new Error(`Expected blocked status, got ${packet.status}`);
  }
  if (packet.governance.applyDecision !== "deny") {
    throw new Error(`Expected deny governance decision, got ${packet.governance.applyDecision}`);
  }
  if (!packet.operatorSummary.includes("blocked")) {
    throw new Error("Operator summary should mention blocked state");
  }

  console.log("✅ testBuildsBlockedStatusWhenGovernedApplyDenies passed");
}

// ============================================================================
// TEST 5 — includes_metrics_and_recommendation_summary
// ============================================================================

function testIncludesMetricsAndRecommendationSummary() {
  const input = makeInput({
    summary: makeSummary({
      totalSignals: 80,
      voiceSuccessRate: 88,
      fallbackRate: 6,
      interruptionBlockRate: 4,
      avgQualityScore: 78,
    }),
    recommendation: makeRecommendation({
      recommendationType: "allow_more_voice_when_success_rate_is_high",
      confidence: "high",
      summary: "System is healthy — safe to expand voice usage.",
    }),
    governedApply: makeGovernedApply({
      applyDecision: "allow_apply",
    }),
  });

  const packet = buildVoiceReviewPacket(input);

  // Check all metrics present
  if (typeof packet.metrics.voiceSuccessRate !== "number") {
    throw new Error("Missing voiceSuccessRate metric");
  }
  if (typeof packet.metrics.fallbackRate !== "number") {
    throw new Error("Missing fallbackRate metric");
  }
  if (typeof packet.metrics.interruptionBlockRate !== "number") {
    throw new Error("Missing interruptionBlockRate metric");
  }
  if (typeof packet.metrics.avgQualityScore !== "number") {
    throw new Error("Missing avgQualityScore metric");
  }
  if (typeof packet.metrics.totalSignals !== "number") {
    throw new Error("Missing totalSignals metric");
  }

  // Check recommendation summary
  if (!packet.recommendation.summary.includes("healthy")) {
    throw new Error("Missing recommendation summary content");
  }

  console.log("✅ testIncludesMetricsAndRecommendationSummary passed");
}

// ============================================================================
// TEST 6 — includes_operator_action_and_warnings
// ============================================================================

function testIncludesOperatorActionAndWarnings() {
  const input = makeInput({
    summary: makeSummary({ totalSignals: 30 }),
    recommendation: makeRecommendation({
      recommendationType: "prefer_fast_voice_for_short_replies",
      warnings: ["fast_voice_quality_is_lower_than_quality_voice"],
    }),
    governedApply: makeGovernedApply({
      applyDecision: "hold",
      warnings: ["wait_for_stabilization_window"],
    }),
  });

  const packet = buildVoiceReviewPacket(input);

  // Operator action should be present
  if (!packet.suggestedOperatorAction || packet.suggestedOperatorAction.length < 10) {
    throw new Error("Missing or too short operator action");
  }

  // Warnings should include both governance and recommendation warnings
  if (packet.warnings.length < 1) {
    throw new Error("Expected warnings in packet");
  }

  console.log("✅ testIncludesOperatorActionAndWarnings passed");
}

// ============================================================================
// TEST 7 — formats_review_packet_for_human_reading
// ============================================================================

function testFormatsReviewPacketForHumanReading() {
  const input = makeInput({
    summary: makeSummary({
      totalSignals: 60,
      voiceSuccessRate: 82,
      fallbackRate: 14,
      interruptionBlockRate: 9,
      avgQualityScore: 84,
    }),
    recommendation: makeRecommendation({
      recommendationType: "prefer_fast_voice_for_short_replies",
      confidence: "high",
      summary: "Fast voice shows lower latency with stable fallback.",
    }),
    governedApply: makeGovernedApply({
      applyDecision: "hold",
      reason: "insufficient_stability_window",
      confidence: "medium",
    }),
  });

  const packet = buildVoiceReviewPacket(input);
  const formatted = formatVoiceReviewPacket(packet);

  // Check all key sections present
  if (!formatted.includes("🎙 Voice Runtime Review")) {
    throw new Error("Missing review header");
  }
  if (!formatted.includes("watch")) {
    throw new Error("Missing status in formatted output");
  }
  if (!formatted.includes("prefer_fast_voice_for_short_replies")) {
    throw new Error("Missing recommendation type");
  }
  if (!formatted.includes("hold")) {
    throw new Error("Missing governance decision");
  }
  if (!formatted.includes("82.0%")) {
    throw new Error("Missing success rate percentage");
  }
  if (!formatted.includes("14.0%")) {
    throw new Error("Missing fallback rate percentage");
  }
  if (!formatted.includes("operator action:")) {
    throw new Error("Missing operator action");
  }

  console.log("✅ testFormatsReviewPacketForHumanReading passed");
}

// ============================================================================
// TEST 8 — always_returns_structured_review_packet
// ============================================================================

function testAlwaysReturnsStructuredReviewPacket() {
  const inputs = [
    makeInput({
      summary: makeSummary({ voiceSuccessRate: 95, fallbackRate: 2 }),
      recommendation: makeRecommendation({ recommendationType: "no_change" }),
      governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
    }),
    makeInput({
      summary: makeSummary({ voiceSuccessRate: 50, fallbackRate: 45 }),
      recommendation: makeRecommendation({ recommendationType: "reduce_voice_usage_when_fallback_spikes" }),
      governedApply: makeGovernedApply({ applyDecision: "deny" }),
    }),
    makeInput({
      summary: makeSummary({ totalSignals: 20 }),
      recommendation: makeRecommendation({ recommendationType: "prefer_fast_voice_for_short_replies" }),
      governedApply: makeGovernedApply({ applyDecision: "hold" }),
    }),
  ];

  for (const input of inputs) {
    const packet = buildVoiceReviewPacket(input);

    // All required fields must be present
    if (!packet.generatedAtMs) throw new Error("Missing generatedAtMs");
    if (!packet.status) throw new Error("Missing status");
    if (!packet.headline) throw new Error("Missing headline");
    if (!packet.operatorSummary) throw new Error("Missing operatorSummary");
    if (!packet.metrics) throw new Error("Missing metrics");
    if (!packet.recommendation) throw new Error("Missing recommendation");
    if (!packet.governance) throw new Error("Missing governance");
    if (!Array.isArray(packet.blockers)) throw new Error("blockers must be array");
    if (!Array.isArray(packet.warnings)) throw new Error("warnings must be array");
    if (!packet.suggestedOperatorAction) throw new Error("Missing suggestedOperatorAction");
  }

  console.log("✅ testAlwaysReturnsStructuredReviewPacket passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Review & Control Surface Tests ===\n");

try {
  testBuildsHealthyStatusWhenRuntimeStrong();
  testBuildsWatchStatusWhenRecommendationHold();
  testBuildsDegradedStatusWhenFallbackHigh();
  testBuildsBlockedStatusWhenGovernedApplyDenies();
  testIncludesMetricsAndRecommendationSummary();
  testIncludesOperatorActionAndWarnings();
  testFormatsReviewPacketForHumanReading();
  testAlwaysReturnsStructuredReviewPacket();

  console.log("\n✅ All voice review surface tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
