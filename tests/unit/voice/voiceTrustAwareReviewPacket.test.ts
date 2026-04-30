import {
  buildVoiceTrustAwareReviewPacket,
  formatVoiceTrustAwareReviewPacket,
  type VoiceTrustAwareReviewPacket,
} from "../../../src/telegram/voiceTrustAwareReviewPacket.js";
import type { VoiceReviewPacket, VoiceReviewStatus } from "../../../src/telegram/voiceReviewSurface.js";
import type { VoiceShapedRecommendation } from "../../../src/telegram/voiceTrustAwareRecommendationShaping.js";
import type { VoiceTrustAwareGovernanceAdvisory } from "../../../src/telegram/voiceTrustAwareGovernanceAdvisory.js";

// ============================================================================
// Helpers
// ============================================================================

function makeReviewPacket(overrides: Partial<VoiceReviewPacket>): VoiceReviewPacket {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    status: overrides.status ?? "healthy",
    headline: overrides.headline ?? "Voice runtime healthy — no action required",
    operatorSummary: overrides.operatorSummary ?? "Voice runtime is healthy.",
    metrics: overrides.metrics ?? {
      voiceSuccessRate: 85.0,
      fallbackRate: 10.0,
      interruptionBlockRate: 5.0,
      avgQualityScore: 75,
      avgLatencyMs: 200,
      totalSignals: 100,
    },
    recommendation: overrides.recommendation ?? {
      type: "prefer_fast_voice_for_short_replies",
      confidence: "high",
      summary: "Consider preferring fast voice for short replies.",
    },
    governance: overrides.governance ?? {
      applyDecision: "allow_apply",
      reason: "sufficient_evidence",
      confidence: "high",
      safeApplyMode: "manual_review_only",
    },
    blockers: overrides.blockers ?? [],
    warnings: overrides.warnings ?? [],
    suggestedOperatorAction: overrides.suggestedOperatorAction ?? "No action required.",
  };
}

function makeShapedRecommendation(overrides: Partial<VoiceShapedRecommendation>): VoiceShapedRecommendation {
  return {
    originalType: overrides.originalType ?? "prefer_fast_voice_for_short_replies",
    originalConfidence: overrides.originalConfidence ?? "medium",
    shapedConfidence: overrides.shapedConfidence ?? "high",
    priority: overrides.priority ?? "normal",
    trustScore: overrides.trustScore ?? 0.85,
    biasStatus: overrides.biasStatus ?? "historically_supported",
    summary: overrides.summary ?? "Shaped recommendation summary.",
    reasons: overrides.reasons ?? ["historical_support_strengthens_recommendation"],
    warnings: overrides.warnings ?? [],
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
  };
}

function makeGovernanceAdvisory(overrides: Partial<VoiceTrustAwareGovernanceAdvisory>): VoiceTrustAwareGovernanceAdvisory {
  return {
    recommendationType: overrides.recommendationType ?? "prefer_fast_voice_for_short_replies",
    governanceAdvisoryStatus: overrides.governanceAdvisoryStatus ?? "governance_supported",
    applyDecision: overrides.applyDecision ?? "allow_apply",
    shapedConfidence: overrides.shapedConfidence ?? "high",
    trustScore: overrides.trustScore ?? 0.85,
    biasStatus: overrides.biasStatus ?? "historically_supported",
    advisorySeverity: overrides.advisorySeverity ?? "low",
    summary: overrides.summary ?? "Governance decision is historically supported.",
    reasons: overrides.reasons ?? ["historical_trust_supports_governance_allow"],
    warnings: overrides.warnings ?? [],
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
  };
}

// ============================================================================
// TEST 1 — builds_supported_trust_aware_review_packet
// ============================================================================

function testBuildsSupportedTrustAwareReviewPacket() {
  const review = makeReviewPacket({ status: "healthy" });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_supported",
    shapedConfidence: "high",
    trustScore: 0.90,
  });
  const governance = makeGovernanceAdvisory({
    governanceAdvisoryStatus: "governance_supported",
    applyDecision: "allow_apply",
    advisorySeverity: "low",
  });

  const packet = buildVoiceTrustAwareReviewPacket(review, shaped, governance);

  if (packet.status !== "healthy") {
    throw new Error(`Expected status healthy, got ${packet.status}`);
  }
  if (packet.trustAwareSummary !== "Voice review is historically supported with high-confidence shaping and low governance risk.") {
    throw new Error(`Unexpected trustAwareSummary: ${packet.trustAwareSummary}`);
  }
  if (packet.governance.governanceAdvisoryStatus !== "governance_supported") {
    throw new Error(`Expected governance_supported, got ${packet.governance.governanceAdvisoryStatus}`);
  }
  if (packet.governance.advisorySeverity !== "low") {
    throw new Error(`Expected low advisory severity, got ${packet.governance.advisorySeverity}`);
  }

  console.log("✅ testBuildsSupportedTrustAwareReviewPacket passed");
}

// ============================================================================
// TEST 2 — builds_caution_trust_aware_review_packet
// ============================================================================

function testBuildsCautionTrustAwareReviewPacket() {
  const review = makeReviewPacket({ status: "watch" });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_uncertain",
    shapedConfidence: "medium",
    trustScore: 0.50,
  });
  const governance = makeGovernanceAdvisory({
    governanceAdvisoryStatus: "governance_caution",
    applyDecision: "hold",
    advisorySeverity: "medium",
  });

  const packet = buildVoiceTrustAwareReviewPacket(review, shaped, governance);

  if (packet.status !== "watch") {
    throw new Error(`Expected status watch, got ${packet.status}`);
  }
  if (packet.trustAwareSummary !== "Voice review remains in caution mode due to mixed historical support or incomplete evidence.") {
    throw new Error(`Unexpected trustAwareSummary: ${packet.trustAwareSummary}`);
  }
  if (packet.governance.governanceAdvisoryStatus !== "governance_caution") {
    throw new Error(`Expected governance_caution, got ${packet.governance.governanceAdvisoryStatus}`);
  }

  console.log("✅ testBuildsCautionTrustAwareReviewPacket passed");
}

// ============================================================================
// TEST 3 — builds_risk_flagged_trust_aware_review_packet
// ============================================================================

function testBuildsRiskFlaggedTrustAwareReviewPacket() {
  const review = makeReviewPacket({ status: "degraded" });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_risky",
    shapedConfidence: "low",
    trustScore: 0.15,
  });
  const governance = makeGovernanceAdvisory({
    governanceAdvisoryStatus: "governance_risk_flagged",
    applyDecision: "deny",
    advisorySeverity: "high",
  });

  const packet = buildVoiceTrustAwareReviewPacket(review, shaped, governance);

  if (packet.status !== "degraded") {
    throw new Error(`Expected status degraded, got ${packet.status}`);
  }
  if (packet.trustAwareSummary !== "Voice review is risk-flagged due to rollback-heavy history or governance denial.") {
    throw new Error(`Unexpected trustAwareSummary: ${packet.trustAwareSummary}`);
  }
  if (packet.governance.governanceAdvisoryStatus !== "governance_risk_flagged") {
    throw new Error(`Expected governance_risk_flagged, got ${packet.governance.governanceAdvisoryStatus}`);
  }
  if (packet.governance.advisorySeverity !== "high") {
    throw new Error(`Expected high advisory severity, got ${packet.governance.advisorySeverity}`);
  }

  console.log("✅ testBuildsRiskFlaggedTrustAwareReviewPacket passed");
}

// ============================================================================
// TEST 4 — propagates_shaped_recommendation_fields
// ============================================================================

function testPropagatesShapedRecommendationFields() {
  const review = makeReviewPacket({});
  const shaped = makeShapedRecommendation({
    originalType: "reduce_voice_usage_when_fallback_spikes",
    originalConfidence: "medium",
    shapedConfidence: "low",
    priority: "low",
    trustScore: 0.25,
    biasStatus: "historically_risky",
  });
  const governance = makeGovernanceAdvisory({});

  const packet = buildVoiceTrustAwareReviewPacket(review, shaped, governance);

  if (packet.recommendation.type !== "reduce_voice_usage_when_fallback_spikes") {
    throw new Error(`Expected type reduce_voice_usage_when_fallback_spikes, got ${packet.recommendation.type}`);
  }
  if (packet.recommendation.originalConfidence !== "medium") {
    throw new Error(`Expected originalConfidence medium, got ${packet.recommendation.originalConfidence}`);
  }
  if (packet.recommendation.shapedConfidence !== "low") {
    throw new Error(`Expected shapedConfidence low, got ${packet.recommendation.shapedConfidence}`);
  }
  if (packet.recommendation.priority !== "low") {
    throw new Error(`Expected priority low, got ${packet.recommendation.priority}`);
  }
  if (packet.recommendation.trustScore !== 0.25) {
    throw new Error(`Expected trustScore 0.25, got ${packet.recommendation.trustScore}`);
  }
  if (packet.recommendation.biasStatus !== "historically_risky") {
    throw new Error(`Expected biasStatus historically_risky, got ${packet.recommendation.biasStatus}`);
  }

  console.log("✅ testPropagatesShapedRecommendationFields passed");
}

// ============================================================================
// TEST 5 — propagates_governance_advisory_fields
// ============================================================================

function testPropagatesGovernanceAdvisoryFields() {
  const review = makeReviewPacket({});
  const shaped = makeShapedRecommendation({});
  const governance = makeGovernanceAdvisory({
    applyDecision: "hold",
    governanceAdvisoryStatus: "governance_caution",
    advisorySeverity: "medium",
  });

  const packet = buildVoiceTrustAwareReviewPacket(review, shaped, governance);

  if (packet.governance.applyDecision !== "hold") {
    throw new Error(`Expected applyDecision hold, got ${packet.governance.applyDecision}`);
  }
  if (packet.governance.governanceAdvisoryStatus !== "governance_caution") {
    throw new Error(`Expected governanceAdvisoryStatus governance_caution, got ${packet.governance.governanceAdvisoryStatus}`);
  }
  if (packet.governance.advisorySeverity !== "medium") {
    throw new Error(`Expected advisorySeverity medium, got ${packet.governance.advisorySeverity}`);
  }

  console.log("✅ testPropagatesGovernanceAdvisoryFields passed");
}

// ============================================================================
// TEST 6 — keeps_review_status_unchanged
// ============================================================================

function testKeepsReviewStatusUnchanged() {
  const statuses: VoiceReviewStatus[] = ["healthy", "watch", "degraded", "blocked"];

  for (const status of statuses) {
    const review = makeReviewPacket({ status });
    const shaped = makeShapedRecommendation({});
    const governance = makeGovernanceAdvisory({});

    const packet = buildVoiceTrustAwareReviewPacket(review, shaped, governance);

    if (packet.status !== status) {
      throw new Error(`Expected status ${status}, got ${packet.status}`);
    }
  }

  console.log("✅ testKeepsReviewStatusUnchanged passed");
}

// ============================================================================
// TEST 7 — merges_reasons_and_warnings_deterministically
// ============================================================================

function testMergesReasonsAndWarningsDeterministically() {
  const review = makeReviewPacket({
    blockers: ["governance_denial_active", "high_fallback_rate"],
    warnings: ["low_quality_score", "duplicate_warning"],
  });
  const shaped = makeShapedRecommendation({
    reasons: ["historical_support_strengthens_recommendation", "high_fallback_rate"],
    warnings: ["historical_risk_reduces_recommendation_confidence", "duplicate_warning"],
  });
  const governance = makeGovernanceAdvisory({
    reasons: ["historical_trust_supports_governance_allow", "high_fallback_rate"],
    warnings: ["low_sample_volume", "duplicate_warning"],
  });

  const packet = buildVoiceTrustAwareReviewPacket(review, shaped, governance);

  // Check no duplicates
  const reasonsSet = new Set(packet.reasons);
  if (packet.reasons.length !== reasonsSet.size) {
    throw new Error(`Reasons should have no duplicates, got ${packet.reasons.length} items with ${reasonsSet.size} unique`);
  }

  const warningsSet = new Set(packet.warnings);
  if (packet.warnings.length !== warningsSet.size) {
    throw new Error(`Warnings should have no duplicates, got ${packet.warnings.length} items with ${warningsSet.size} unique`);
  }

  // Check sorted
  const sortedReasons = [...packet.reasons].sort();
  if (JSON.stringify(packet.reasons) !== JSON.stringify(sortedReasons)) {
    throw new Error("Reasons should be sorted");
  }

  const sortedWarnings = [...packet.warnings].sort();
  if (JSON.stringify(packet.warnings) !== JSON.stringify(sortedWarnings)) {
    throw new Error("Warnings should be sorted");
  }

  // Check all sources merged
  if (!packet.reasons.includes("governance_denial_active")) {
    throw new Error("Missing governance_denial_active from blockers");
  }
  if (!packet.reasons.includes("historical_support_strengthens_recommendation")) {
    throw new Error("Missing historical_support_strengthens_recommendation from shaped");
  }
  if (!packet.reasons.includes("historical_trust_supports_governance_allow")) {
    throw new Error("Missing historical_trust_supports_governance_allow from governance");
  }
  if (!packet.warnings.includes("duplicate_warning")) {
    throw new Error("duplicate_warning should appear once (deduplicated)");
  }
  if (packet.warnings.filter(w => w === "duplicate_warning").length !== 1) {
    // Check by counting in original arrays — final should have exactly 1
    const count = packet.warnings.filter(w => w === "duplicate_warning").length;
    if (count !== 1) {
      throw new Error(`duplicate_warning should appear exactly once, got ${count}`);
    }
  }

  console.log("✅ testMergesReasonsAndWarningsDeterministically passed");
}

// ============================================================================
// TEST 8 — assigns_operator_action_by_governance_status
// ============================================================================

function testAssignsOperatorActionByGovernanceStatus() {
  const review = makeReviewPacket({});
  const shaped = makeShapedRecommendation({});

  // governance_supported
  const governanceSupported = makeGovernanceAdvisory({ governanceAdvisoryStatus: "governance_supported" });
  const packetSupported = buildVoiceTrustAwareReviewPacket(review, shaped, governanceSupported);
  if (packetSupported.suggestedOperatorAction !== "Safe to continue observation or operator approval flow.") {
    throw new Error(`Unexpected operator action for governance_supported: ${packetSupported.suggestedOperatorAction}`);
  }

  // governance_caution
  const governanceCaution = makeGovernanceAdvisory({ governanceAdvisoryStatus: "governance_caution" });
  const packetCaution = buildVoiceTrustAwareReviewPacket(review, shaped, governanceCaution);
  if (packetCaution.suggestedOperatorAction !== "Continue observation and avoid premature policy escalation.") {
    throw new Error(`Unexpected operator action for governance_caution: ${packetCaution.suggestedOperatorAction}`);
  }

  // governance_risk_flagged
  const governanceRisk = makeGovernanceAdvisory({ governanceAdvisoryStatus: "governance_risk_flagged" });
  const packetRisk = buildVoiceTrustAwareReviewPacket(review, shaped, governanceRisk);
  if (packetRisk.suggestedOperatorAction !== "Avoid operator approval until historical risk profile stabilizes.") {
    throw new Error(`Unexpected operator action for governance_risk_flagged: ${packetRisk.suggestedOperatorAction}`);
  }

  console.log("✅ testAssignsOperatorActionByGovernanceStatus passed");
}

// ============================================================================
// TEST 9 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const review = makeReviewPacket({});
  const shaped = makeShapedRecommendation({});
  const governance = makeGovernanceAdvisory({});

  const packet = buildVoiceTrustAwareReviewPacket(review, shaped, governance);
  const formatted = formatVoiceTrustAwareReviewPacket(packet);

  if (!formatted.includes("🧠 Voice Trust-Aware Review")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("status:")) {
    throw new Error("Missing status in formatted output");
  }
  if (!formatted.includes("headline:")) {
    throw new Error("Missing headline in formatted output");
  }
  if (!formatted.includes("recommendation:")) {
    throw new Error("Missing recommendation in formatted output");
  }
  if (!formatted.includes("shaped confidence:")) {
    throw new Error("Missing shaped confidence in formatted output");
  }
  if (!formatted.includes("priority:")) {
    throw new Error("Missing priority in formatted output");
  }
  if (!formatted.includes("trust score:")) {
    throw new Error("Missing trust score in formatted output");
  }
  if (!formatted.includes("governance advisory:")) {
    throw new Error("Missing governance advisory in formatted output");
  }
  if (!formatted.includes("operator action:")) {
    throw new Error("Missing operator action in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_input_objects
// ============================================================================

function testDoesNotMutateInputObjects() {
  const review = makeReviewPacket({
    status: "watch",
    headline: "Original headline",
    operatorSummary: "Original summary",
    blockers: ["blocker_1"],
    warnings: ["warning_1"],
  });
  const shaped = makeShapedRecommendation({
    originalType: "original_type",
    shapedConfidence: "high",
    trustScore: 0.85,
    reasons: ["reason_1"],
    warnings: ["warning_2"],
  });
  const governance = makeGovernanceAdvisory({
    applyDecision: "allow_apply",
    governanceAdvisoryStatus: "governance_supported",
    reasons: ["reason_2"],
    warnings: ["warning_3"],
  });

  // Store original values
  const originalReview = { ...review, blockers: [...review.blockers], warnings: [...review.warnings] };
  const originalShaped = { ...shaped, reasons: [...shaped.reasons], warnings: [...shaped.warnings] };
  const originalGovernance = { ...governance, reasons: [...governance.reasons], warnings: [...governance.warnings] };

  // Build packet
  buildVoiceTrustAwareReviewPacket(review, shaped, governance);

  // Verify review unchanged
  if (review.status !== originalReview.status) {
    throw new Error("Review status should not be mutated");
  }
  if (review.headline !== originalReview.headline) {
    throw new Error("Review headline should not be mutated");
  }
  if (review.operatorSummary !== originalReview.operatorSummary) {
    throw new Error("Review operatorSummary should not be mutated");
  }
  if (JSON.stringify(review.blockers) !== JSON.stringify(originalReview.blockers)) {
    throw new Error("Review blockers should not be mutated");
  }
  if (JSON.stringify(review.warnings) !== JSON.stringify(originalReview.warnings)) {
    throw new Error("Review warnings should not be mutated");
  }

  // Verify shaped unchanged
  if (shaped.originalType !== originalShaped.originalType) {
    throw new Error("Shaped originalType should not be mutated");
  }
  if (shaped.shapedConfidence !== originalShaped.shapedConfidence) {
    throw new Error("Shaped shapedConfidence should not be mutated");
  }
  if (shaped.trustScore !== originalShaped.trustScore) {
    throw new Error("Shaped trustScore should not be mutated");
  }

  // Verify governance unchanged
  if (governance.applyDecision !== originalGovernance.applyDecision) {
    throw new Error("Governance applyDecision should not be mutated");
  }
  if (governance.governanceAdvisoryStatus !== originalGovernance.governanceAdvisoryStatus) {
    throw new Error("Governance governanceAdvisoryStatus should not be mutated");
  }

  console.log("✅ testDoesNotMutateInputObjects passed");
}

// ============================================================================
// TEST 11 — metrics_propagated_correctly
// ============================================================================

function testMetricsPropagatedCorrectly() {
  const review = makeReviewPacket({
    metrics: {
      voiceSuccessRate: 72.5,
      fallbackRate: 22.3,
      interruptionBlockRate: 8.1,
      avgQualityScore: 55,
      avgLatencyMs: 310,
      totalSignals: 150,
    },
  });
  const shaped = makeShapedRecommendation({});
  const governance = makeGovernanceAdvisory({});

  const packet = buildVoiceTrustAwareReviewPacket(review, shaped, governance);

  if (packet.metrics.voiceSuccessRate !== 72.5) {
    throw new Error(`Expected voiceSuccessRate 72.5, got ${packet.metrics.voiceSuccessRate}`);
  }
  if (packet.metrics.fallbackRate !== 22.3) {
    throw new Error(`Expected fallbackRate 22.3, got ${packet.metrics.fallbackRate}`);
  }
  if (packet.metrics.interruptionBlockRate !== 8.1) {
    throw new Error(`Expected interruptionBlockRate 8.1, got ${packet.metrics.interruptionBlockRate}`);
  }
  if (packet.metrics.avgQualityScore !== 55) {
    throw new Error(`Expected avgQualityScore 55, got ${packet.metrics.avgQualityScore}`);
  }
  if (packet.metrics.avgLatencyMs !== 310) {
    throw new Error(`Expected avgLatencyMs 310, got ${packet.metrics.avgLatencyMs}`);
  }
  if (packet.metrics.totalSignals !== 150) {
    throw new Error(`Expected totalSignals 150, got ${packet.metrics.totalSignals}`);
  }

  console.log("✅ testMetricsPropagatedCorrectly passed");
}

// ============================================================================
// TEST 12 — trust_aware_summary_varies_by_governance_status
// ============================================================================

function testTrustAwareSummaryVariesByGovernanceStatus() {
  const review = makeReviewPacket({});
  const shaped = makeShapedRecommendation({});

  const statuses = ["governance_supported", "governance_caution", "governance_risk_flagged"] as const;
  const summaries = new Set<string>();

  for (const status of statuses) {
    const governance = makeGovernanceAdvisory({ governanceAdvisoryStatus: status });
    const packet = buildVoiceTrustAwareReviewPacket(review, shaped, governance);
    summaries.add(packet.trustAwareSummary);
  }

  if (summaries.size !== 3) {
    throw new Error(`Expected 3 unique trustAwareSummary values, got ${summaries.size}`);
  }

  console.log("✅ testTrustAwareSummaryVariesByGovernanceStatus passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Trust-Aware Review Packet Tests ===\n");

try {
  testBuildsSupportedTrustAwareReviewPacket();
  testBuildsCautionTrustAwareReviewPacket();
  testBuildsRiskFlaggedTrustAwareReviewPacket();
  testPropagatesShapedRecommendationFields();
  testPropagatesGovernanceAdvisoryFields();
  testKeepsReviewStatusUnchanged();
  testMergesReasonsAndWarningsDeterministically();
  testAssignsOperatorActionByGovernanceStatus();
  testFormatsOutputCorrectly();
  testDoesNotMutateInputObjects();
  testMetricsPropagatedCorrectly();
  testTrustAwareSummaryVariesByGovernanceStatus();

  console.log("\n✅ All voice trust-aware review packet tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
