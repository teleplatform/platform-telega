import {
  buildVoiceTrustAwareGovernanceAdvisory,
  formatVoiceTrustAwareGovernanceAdvisory,
  type VoiceTrustAwareGovernanceAdvisory,
} from "../../../src/telegram/voiceTrustAwareGovernanceAdvisory.js";
import type { VoiceGovernedApplyResult } from "../../../src/telegram/voiceGovernedApplyGate.js";
import type { VoiceShapedRecommendation } from "../../../src/telegram/voiceTrustAwareRecommendationShaping.js";

// ============================================================================
// Helpers
// ============================================================================

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
    generatedAtMs: Date.now(),
  };
}

// ============================================================================
// TEST 1 — builds_governance_supported_for_allow_plus_trusted
// ============================================================================

function testBuildsGovernanceSupportedForAllowPlusTrusted() {
  const governedApply = makeGovernedApply({ applyDecision: "allow_apply" });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_supported",
    shapedConfidence: "high",
    trustScore: 0.90,
  });

  const advisory = buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);

  if (advisory.governanceAdvisoryStatus !== "governance_supported") {
    throw new Error(`Expected governance_supported, got ${advisory.governanceAdvisoryStatus}`);
  }
  if (advisory.advisorySeverity !== "low") {
    throw new Error(`Expected low advisory severity, got ${advisory.advisorySeverity}`);
  }
  if (!advisory.summary.includes("historically supported")) {
    throw new Error("Summary should mention historically supported");
  }
  if (!advisory.reasons.includes("historical_trust_supports_governance_allow")) {
    throw new Error("Missing historical_trust_supports_governance_allow reason");
  }

  console.log("✅ testBuildsGovernanceSupportedForAllowPlusTrusted passed");
}

// ============================================================================
// TEST 2 — builds_governance_caution_for_hold_state
// ============================================================================

function testBuildsGovernanceCautionForHoldState() {
  const governedApply = makeGovernedApply({ applyDecision: "hold" });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_supported",
    shapedConfidence: "high",
  });

  const advisory = buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);

  if (advisory.governanceAdvisoryStatus !== "governance_caution") {
    throw new Error(`Expected governance_caution, got ${advisory.governanceAdvisoryStatus}`);
  }
  if (advisory.advisorySeverity !== "medium") {
    throw new Error(`Expected medium advisory severity, got ${advisory.advisorySeverity}`);
  }
  if (!advisory.summary.includes("cautious")) {
    throw new Error("Summary should mention cautious");
  }

  console.log("✅ testBuildsGovernanceCautionForHoldState passed");
}

// ============================================================================
// TEST 3 — builds_governance_caution_for_uncertain_bias
// ============================================================================

function testBuildsGovernanceCautionForUncertainBias() {
  const governedApply = makeGovernedApply({ applyDecision: "allow_apply" });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_uncertain",
    shapedConfidence: "medium",
  });

  const advisory = buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);

  if (advisory.governanceAdvisoryStatus !== "governance_caution") {
    throw new Error(`Expected governance_caution, got ${advisory.governanceAdvisoryStatus}`);
  }
  if (!advisory.reasons.includes("historical_signal_is_mixed_for_governance")) {
    throw new Error("Missing historical_signal_is_mixed_for_governance reason");
  }

  console.log("✅ testBuildsGovernanceCautionForUncertainBias passed");
}

// ============================================================================
// TEST 4 — builds_governance_risk_flagged_for_risky_bias
// ============================================================================

function testBuildsGovernanceRiskFlaggedForRiskyBias() {
  const governedApply = makeGovernedApply({ applyDecision: "allow_apply" });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_risky",
    shapedConfidence: "low",
    trustScore: 0.15,
  });

  const advisory = buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);

  if (advisory.governanceAdvisoryStatus !== "governance_risk_flagged") {
    throw new Error(`Expected governance_risk_flagged, got ${advisory.governanceAdvisoryStatus}`);
  }
  if (advisory.advisorySeverity !== "high") {
    throw new Error(`Expected high advisory severity, got ${advisory.advisorySeverity}`);
  }
  if (!advisory.warnings.includes("historical_risk_flags_governance_review")) {
    throw new Error("Missing historical_risk_flags_governance_review warning");
  }

  console.log("✅ testBuildsGovernanceRiskFlaggedForRiskyBias passed");
}

// ============================================================================
// TEST 5 — builds_governance_risk_flagged_for_deny_state
// ============================================================================

function testBuildsGovernanceRiskFlaggedForDenyState() {
  const governedApply = makeGovernedApply({
    applyDecision: "deny",
    reason: "voice_runtime_unstable",
  });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_supported",
    shapedConfidence: "high",
  });

  const advisory = buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);

  if (advisory.governanceAdvisoryStatus !== "governance_risk_flagged") {
    throw new Error(`Expected governance_risk_flagged for deny, got ${advisory.governanceAdvisoryStatus}`);
  }
  if (!advisory.warnings.includes("governance_denial_is_consistent_with_risk_profile")) {
    throw new Error("Missing governance_denial_is_consistent_with_risk_profile warning");
  }

  console.log("✅ testBuildsGovernanceRiskFlaggedForDenyState passed");
}

// ============================================================================
// TEST 6 — propagates_trust_score_and_confidence
// ============================================================================

function testPropagatesTrustScoreAndConfidence() {
  const governedApply = makeGovernedApply({ applyDecision: "allow_apply" });
  const shaped = makeShapedRecommendation({
    trustScore: 0.78,
    shapedConfidence: "medium",
    biasStatus: "historically_uncertain",
  });

  const advisory = buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);

  if (advisory.trustScore !== 0.78) {
    throw new Error(`Expected trust score 0.78, got ${advisory.trustScore}`);
  }
  if (advisory.shapedConfidence !== "medium") {
    throw new Error(`Expected shaped confidence medium, got ${advisory.shapedConfidence}`);
  }
  if (advisory.biasStatus !== "historically_uncertain") {
    throw new Error(`Expected historically_uncertain, got ${advisory.biasStatus}`);
  }

  console.log("✅ testPropagatesTrustScoreAndConfidence passed");
}

// ============================================================================
// TEST 7 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const governedApply = makeGovernedApply({ applyDecision: "allow_apply" });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_supported",
    shapedConfidence: "high",
  });

  const advisory1 = buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);
  const advisory2 = buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);

  // Strip generatedAtMs for comparison
  const a1 = { ...advisory1, generatedAtMs: 0 };
  const a2 = { ...advisory2, generatedAtMs: 0 };

  if (JSON.stringify(a1) !== JSON.stringify(a2)) {
    throw new Error("Governance advisory should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 8 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const governedApply = makeGovernedApply({
    applyDecision: "hold",
    warnings: ["insufficient_evidence_window"],
  });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_uncertain",
    reasons: ["historical_signal_is_mixed"],
    warnings: ["low_sample_volume"],
  });

  const advisory = buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);

  // Should have both governance-specific and inherited reasons/warnings
  if (advisory.reasons.length === 0) {
    throw new Error("Advisory should have reasons");
  }
  if (advisory.warnings.length === 0) {
    throw new Error("Advisory should have warnings");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 9 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const governedApply = makeGovernedApply({ applyDecision: "allow_apply" });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_supported",
    shapedConfidence: "high",
  });

  const advisory = buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);
  const formatted = formatVoiceTrustAwareGovernanceAdvisory(advisory);

  if (!formatted.includes("🛡 Voice Trust-Aware Governance Advisory")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("apply decision")) {
    throw new Error("Missing apply decision in formatted output");
  }
  if (!formatted.includes("advisory status")) {
    throw new Error("Missing advisory status in formatted output");
  }
  if (!formatted.includes("advisory severity")) {
    throw new Error("Missing advisory severity in formatted output");
  }
  if (!formatted.includes("shaped confidence")) {
    throw new Error("Missing shaped confidence in formatted output");
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
// TEST 10 — does_not_mutate_governed_apply_result
// ============================================================================

function testDoesNotMutateGovernedApplyResult() {
  const governedApply = makeGovernedApply({
    applyDecision: "allow_apply",
    reason: "sufficient_evidence",
  });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_supported",
    shapedConfidence: "high",
  });

  // Store original values
  const originalApplyDecision = governedApply.applyDecision;
  const originalReason = governedApply.reason;

  // Build advisory
  buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);

  // Should be unchanged
  if (governedApply.applyDecision !== originalApplyDecision) {
    throw new Error("Advisory should not mutate governedApply.applyDecision");
  }
  if (governedApply.reason !== originalReason) {
    throw new Error("Advisory should not mutate governedApply.reason");
  }

  console.log("✅ testDoesNotMutateGovernedApplyResult passed");
}

// ============================================================================
// TEST 11 — does_not_mutate_shaped_recommendation
// ============================================================================

function testDoesNotMutateShapedRecommendation() {
  const governedApply = makeGovernedApply({ applyDecision: "allow_apply" });
  const shaped = makeShapedRecommendation({
    originalType: "prefer_fast_voice_for_short_replies",
    shapedConfidence: "high",
    trustScore: 0.85,
  });

  const originalType = shaped.originalType;
  const originalConfidence = shaped.shapedConfidence;

  buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);

  if (shaped.originalType !== originalType) {
    throw new Error("Advisory should not mutate shaped.originalType");
  }
  if (shaped.shapedConfidence !== originalConfidence) {
    throw new Error("Advisory should not mutate shaped.shapedConfidence");
  }

  console.log("✅ testDoesNotMutateShapedRecommendation passed");
}

// ============================================================================
// TEST 12 — includes_governance_warning_when_deny_matches_risk
// ============================================================================

function testIncludesGovernanceWarningWhenDenyMatchesRisk() {
  const governedApply = makeGovernedApply({
    applyDecision: "deny",
    reason: "voice_runtime_unstable",
  });
  const shaped = makeShapedRecommendation({
    biasStatus: "historically_risky",
    shapedConfidence: "low",
    trustScore: 0.15,
  });

  const advisory = buildVoiceTrustAwareGovernanceAdvisory(governedApply, shaped);

  if (advisory.governanceAdvisoryStatus !== "governance_risk_flagged") {
    throw new Error(`Expected governance_risk_flagged, got ${advisory.governanceAdvisoryStatus}`);
  }
  if (!advisory.warnings.includes("historical_risk_flags_governance_review")) {
    throw new Error("Missing historical_risk_flags_governance_review warning");
  }
  if (!advisory.warnings.includes("governance_denial_is_consistent_with_risk_profile")) {
    throw new Error("Missing governance_denial_is_consistent_with_risk_profile warning");
  }

  console.log("✅ testIncludesGovernanceWarningWhenDenyMatchesRisk passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Trust-Aware Governance Advisory Tests ===\n");

try {
  testBuildsGovernanceSupportedForAllowPlusTrusted();
  testBuildsGovernanceCautionForHoldState();
  testBuildsGovernanceCautionForUncertainBias();
  testBuildsGovernanceRiskFlaggedForRiskyBias();
  testBuildsGovernanceRiskFlaggedForDenyState();
  testPropagatesTrustScoreAndConfidence();
  testReturnsDeterministicOutput();
  testIncludesReasonsAndWarnings();
  testFormatsOutputCorrectly();
  testDoesNotMutateGovernedApplyResult();
  testDoesNotMutateShapedRecommendation();
  testIncludesGovernanceWarningWhenDenyMatchesRisk();

  console.log("\n✅ All voice trust-aware governance advisory tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
