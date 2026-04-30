import {
  determineVoiceApprovalReadiness,
  formatVoiceApprovalReadinessDecision,
  type VoiceApprovalReadinessDecision,
} from "../../../src/telegram/voiceApprovalReadiness.js";
import type { VoiceApprovalRoutingDecision } from "../../../src/telegram/voiceApprovalRouting.js";
import type { VoiceTrustAwareReviewPacket } from "../../../src/telegram/voiceTrustAwareReviewPacket.js";

// ============================================================================
// helpers
// ============================================================================

function makeRoutingDecision(
  overrides: Partial<VoiceApprovalRoutingDecision>,
): VoiceApprovalRoutingDecision {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    route: overrides.route ?? "passive_archive",
    approvalRequired: overrides.approvalRequired ?? false,
    targetLane: overrides.targetLane ?? "archive_lane",
    summary: overrides.summary ?? "Voice case archived passively.",
    routingReason: overrides.routingReason ?? "P3 priority indicates healthy state.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

function makeReviewPacket(
  overrides: Partial<VoiceTrustAwareReviewPacket>,
): VoiceTrustAwareReviewPacket {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    status: overrides.status ?? "healthy",
    headline: overrides.headline ?? "Voice runtime healthy",
    operatorSummary: overrides.operatorSummary ?? "Voice runtime is healthy.",
    trustAwareSummary: overrides.trustAwareSummary ?? "Voice review is historically supported.",
    recommendation: overrides.recommendation ?? {
      type: "prefer_fast_voice_for_short_replies",
      originalConfidence: "high",
      shapedConfidence: "high",
      priority: "normal",
      trustScore: 0.85,
      biasStatus: "historically_supported",
    },
    governance: overrides.governance ?? {
      applyDecision: "allow_apply",
      governanceAdvisoryStatus: "governance_supported",
      advisorySeverity: "low",
    },
    metrics: overrides.metrics ?? {
      voiceSuccessRate: 85.0,
      fallbackRate: 10.0,
      interruptionBlockRate: 5.0,
      avgQualityScore: 75,
      avgLatencyMs: 200,
      totalSignals: 100,
    },
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
    suggestedOperatorAction: overrides.suggestedOperatorAction ?? "No action required.",
  };
}

// ============================================================================
// TEST 1 — marks_blocked_case_as_not_ready
// ============================================================================

function testMarksBlockedCaseAsNotReady() {
  const routing = makeRoutingDecision({ route: "immediate_human_review" });
  const packet = makeReviewPacket({ status: "blocked" });

  const readiness = determineVoiceApprovalReadiness(routing, packet);

  if (readiness.readinessStatus !== "not_ready_risk_blocked") {
    throw new Error(`Expected not_ready_risk_blocked, got ${readiness.readinessStatus}`);
  }
  if (readiness.approvalEligible !== false) {
    throw new Error("Expected approvalEligible to be false for blocked case");
  }
  if (readiness.humanApprovalRecommended !== false) {
    throw new Error("Expected humanApprovalRecommended to be false for blocked case");
  }
  if (readiness.evidenceSufficiency !== "low") {
    throw new Error(`Expected evidenceSufficiency low, got ${readiness.evidenceSufficiency}`);
  }

  console.log("✅ testMarksBlockedCaseAsNotReady passed");
}

// ============================================================================
// TEST 2 — marks_risk_flagged_case_as_not_ready
// ============================================================================

function testMarksRiskFlaggedCaseAsNotReady() {
  const routing = makeRoutingDecision({ route: "priority_operator_review" });
  const packet = makeReviewPacket({
    status: "watch",
    governance: {
      applyDecision: "hold",
      governanceAdvisoryStatus: "governance_risk_flagged",
      advisorySeverity: "high",
    },
  });

  const readiness = determineVoiceApprovalReadiness(routing, packet);

  if (readiness.readinessStatus !== "not_ready_risk_blocked") {
    throw new Error(`Expected not_ready_risk_blocked for risk-flagged, got ${readiness.readinessStatus}`);
  }
  if (readiness.approvalEligible !== false) {
    throw new Error("Expected approvalEligible to be false for risk-flagged");
  }
  if (readiness.evidenceSufficiency !== "low") {
    throw new Error(`Expected evidenceSufficiency low, got ${readiness.evidenceSufficiency}`);
  }

  console.log("✅ testMarksRiskFlaggedCaseAsNotReady passed");
}

// ============================================================================
// TEST 3 — marks_priority_review_case_as_needing_observation
// ============================================================================

function testMarksPriorityReviewCaseAsNeedingObservation() {
  const routing = makeRoutingDecision({ route: "priority_operator_review" });
  const packet = makeReviewPacket({
    status: "degraded",
    governance: {
      applyDecision: "hold",
      governanceAdvisoryStatus: "governance_caution",
      advisorySeverity: "medium",
    },
    recommendation: {
      type: "reduce_voice_usage_when_fallback_spikes",
      originalConfidence: "medium",
      shapedConfidence: "low",
      priority: "high",
      trustScore: 0.45,
      biasStatus: "historically_risky",
    },
  });

  const readiness = determineVoiceApprovalReadiness(routing, packet);

  if (readiness.readinessStatus !== "needs_more_observation") {
    throw new Error(`Expected needs_more_observation, got ${readiness.readinessStatus}`);
  }
  if (readiness.approvalEligible !== false) {
    throw new Error("Expected approvalEligible to be false for priority review");
  }
  if (readiness.humanApprovalRecommended !== true) {
    throw new Error("Expected humanApprovalRecommended to be true for priority review");
  }
  if (readiness.evidenceSufficiency !== "medium") {
    throw new Error(`Expected evidenceSufficiency medium, got ${readiness.evidenceSufficiency}`);
  }

  console.log("✅ testMarksPriorityReviewCaseAsNeedingObservation passed");
}

// ============================================================================
// TEST 4 — marks_observation_only_case_as_needing_observation
// ============================================================================

function testMarksObservationOnlyCaseAsNeedingObservation() {
  const routing = makeRoutingDecision({ route: "observation_only" });
  const packet = makeReviewPacket({
    status: "watch",
    governance: {
      applyDecision: "hold",
      governanceAdvisoryStatus: "governance_supported",
      advisorySeverity: "low",
    },
  });

  const readiness = determineVoiceApprovalReadiness(routing, packet);

  if (readiness.readinessStatus !== "needs_more_observation") {
    throw new Error(`Expected needs_more_observation for observation_only, got ${readiness.readinessStatus}`);
  }
  if (readiness.approvalEligible !== false) {
    throw new Error("Expected approvalEligible to be false for observation_only");
  }
  if (readiness.evidenceSufficiency !== "medium") {
    throw new Error(`Expected evidenceSufficiency medium, got ${readiness.evidenceSufficiency}`);
  }

  console.log("✅ testMarksObservationOnlyCaseAsNeedingObservation passed");
}

// ============================================================================
// TEST 5 — marks_healthy_supported_case_as_ready
// ============================================================================

function testMarksHealthySupportedCaseAsReady() {
  const routing = makeRoutingDecision({ route: "passive_archive" });
  const packet = makeReviewPacket({
    status: "healthy",
    governance: {
      applyDecision: "allow_apply",
      governanceAdvisoryStatus: "governance_supported",
      advisorySeverity: "low",
    },
    recommendation: {
      type: "no_change",
      originalConfidence: "high",
      shapedConfidence: "high",
      priority: "normal",
      trustScore: 0.9,
      biasStatus: "historically_supported",
    },
  });

  const readiness = determineVoiceApprovalReadiness(routing, packet);

  if (readiness.readinessStatus !== "ready_for_human_approval") {
    throw new Error(`Expected ready_for_human_approval, got ${readiness.readinessStatus}`);
  }
  if (readiness.approvalEligible !== true) {
    throw new Error("Expected approvalEligible to be true for healthy case");
  }
  if (readiness.humanApprovalRecommended !== true) {
    throw new Error("Expected humanApprovalRecommended to be true for healthy case");
  }
  if (readiness.evidenceSufficiency !== "high") {
    throw new Error(`Expected evidenceSufficiency high, got ${readiness.evidenceSufficiency}`);
  }

  console.log("✅ testMarksHealthySupportedCaseAsReady passed");
}

// ============================================================================
// TEST 6 — sets_approval_eligible_correctly
// ============================================================================

function testSetsApprovalEligibleCorrectly() {
  const blockedRouting = makeRoutingDecision({ route: "immediate_human_review" });
  const blockedPacket = makeReviewPacket({ status: "blocked" });

  const observationRouting = makeRoutingDecision({ route: "observation_only" });
  const observationPacket = makeReviewPacket({ status: "watch" });

  const readyRouting = makeRoutingDecision({ route: "passive_archive" });
  const readyPacket = makeReviewPacket({
    status: "healthy",
    governance: {
      applyDecision: "allow_apply",
      governanceAdvisoryStatus: "governance_supported",
      advisorySeverity: "low",
    },
    recommendation: makeReviewPacket({}).recommendation,
  });

  const blockedReadiness = determineVoiceApprovalReadiness(blockedRouting, blockedPacket);
  const observationReadiness = determineVoiceApprovalReadiness(observationRouting, observationPacket);
  const readyReadiness = determineVoiceApprovalReadiness(readyRouting, readyPacket);

  if (blockedReadiness.approvalEligible !== false) {
    throw new Error("Blocked case should NOT be approval eligible");
  }
  if (observationReadiness.approvalEligible !== false) {
    throw new Error("Observation case should NOT be approval eligible");
  }
  if (readyReadiness.approvalEligible !== true) {
    throw new Error("Healthy case SHOULD be approval eligible");
  }

  console.log("✅ testSetsApprovalEligibleCorrectly passed");
}

// ============================================================================
// TEST 7 — sets_evidence_sufficiency_correctly
// ============================================================================

function testSetsEvidenceSufficiencyCorrectly() {
  const blockedRouting = makeRoutingDecision({ route: "immediate_human_review" });
  const blockedPacket = makeReviewPacket({ status: "blocked" });

  const observationRouting = makeRoutingDecision({ route: "observation_only" });
  const observationPacket = makeReviewPacket({ status: "watch" });

  const readyRouting = makeRoutingDecision({ route: "passive_archive" });
  const readyPacket = makeReviewPacket({
    status: "healthy",
    governance: {
      applyDecision: "allow_apply",
      governanceAdvisoryStatus: "governance_supported",
      advisorySeverity: "low",
    },
    recommendation: makeReviewPacket({}).recommendation,
  });

  const blockedReadiness = determineVoiceApprovalReadiness(blockedRouting, blockedPacket);
  const observationReadiness = determineVoiceApprovalReadiness(observationRouting, observationPacket);
  const readyReadiness = determineVoiceApprovalReadiness(readyRouting, readyPacket);

  if (blockedReadiness.evidenceSufficiency !== "low") {
    throw new Error(`Expected low evidence for blocked, got ${blockedReadiness.evidenceSufficiency}`);
  }
  if (observationReadiness.evidenceSufficiency !== "medium") {
    throw new Error(`Expected medium evidence for observation, got ${observationReadiness.evidenceSufficiency}`);
  }
  if (readyReadiness.evidenceSufficiency !== "high") {
    throw new Error(`Expected high evidence for ready, got ${readyReadiness.evidenceSufficiency}`);
  }

  console.log("✅ testSetsEvidenceSufficiencyCorrectly passed");
}

// ============================================================================
// TEST 8 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const blockedRouting = makeRoutingDecision({
    route: "immediate_human_review",
    reasons: ["routing_reason_a"],
    warnings: ["routing_warning_a"],
  });
  const blockedPacket = makeReviewPacket({
    status: "blocked",
    reasons: ["packet_reason_a"],
    warnings: ["packet_warning_a"],
  });

  const readyRouting = makeRoutingDecision({ route: "passive_archive" });
  const readyPacket = makeReviewPacket({
    status: "healthy",
    governance: {
      applyDecision: "allow_apply",
      governanceAdvisoryStatus: "governance_supported",
      advisorySeverity: "low",
    },
    recommendation: makeReviewPacket({}).recommendation,
  });

  const blockedReadiness = determineVoiceApprovalReadiness(blockedRouting, blockedPacket);
  const readyReadiness = determineVoiceApprovalReadiness(readyRouting, readyPacket);

  // Blocked should have reasons and warnings
  if (blockedReadiness.reasons.length === 0) {
    throw new Error("Blocked readiness should include reasons");
  }
  if (blockedReadiness.warnings.length === 0) {
    throw new Error("Blocked readiness should include warnings");
  }

  // Ready should have reasons
  if (readyReadiness.reasons.length === 0) {
    throw new Error("Ready readiness should include reasons");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 9 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const routing = makeRoutingDecision({ route: "immediate_human_review" });
  const packet = makeReviewPacket({ status: "blocked" });

  const readiness = determineVoiceApprovalReadiness(routing, packet);
  const formatted = formatVoiceApprovalReadinessDecision(readiness);

  if (!formatted.includes("🧪 Voice Approval Readiness")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("readiness status:")) {
    throw new Error("Missing readiness status in formatted output");
  }
  if (!formatted.includes("approval eligible:")) {
    throw new Error("Missing approval eligible in formatted output");
  }
  if (!formatted.includes("evidence sufficiency:")) {
    throw new Error("Missing evidence sufficiency in formatted output");
  }
  if (!formatted.includes("human approval recommended:")) {
    throw new Error("Missing human approval recommended in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("operator guidance:")) {
    throw new Error("Missing operator guidance in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_inputs
// ============================================================================

function testDoesNotMutateInputs() {
  const routing = makeRoutingDecision({
    route: "priority_operator_review",
    reasons: ["routing_reason"],
    warnings: ["routing_warning"],
  });
  const packet = makeReviewPacket({
    status: "degraded",
    reasons: ["packet_reason"],
    warnings: ["packet_warning"],
  });

  const originalRouting = JSON.stringify(routing);
  const originalPacket = JSON.stringify(packet);

  determineVoiceApprovalReadiness(routing, packet);

  if (JSON.stringify(routing) !== originalRouting) {
    throw new Error("Routing decision should not be mutated");
  }
  if (JSON.stringify(packet) !== originalPacket) {
    throw new Error("Review packet should not be mutated");
  }

  console.log("✅ testDoesNotMutateInputs passed");
}

// ============================================================================
// TEST 11 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const routing = makeRoutingDecision({
    route: "priority_operator_review",
    reasons: ["reason_a", "reason_b"],
    warnings: ["warning_a"],
  });
  const packet = makeReviewPacket({
    status: "degraded",
    reasons: ["packet_reason_a"],
    warnings: ["packet_warning_a"],
  });

  const readiness1 = determineVoiceApprovalReadiness(routing, packet);
  const readiness2 = determineVoiceApprovalReadiness(routing, packet);

  // Strip generatedAtMs for comparison
  const r1 = { ...readiness1, generatedAtMs: 0 };
  const r2 = { ...readiness2, generatedAtMs: 0 };

  if (JSON.stringify(r1) !== JSON.stringify(r2)) {
    throw new Error("Approval readiness decision should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 12 — low_trust_score_triggers_needs_observation
// ============================================================================

function testLowTrustScoreTriggersNeedsObservation() {
  const routing = makeRoutingDecision({ route: "passive_archive" });
  const packet = makeReviewPacket({
    status: "healthy",
    governance: {
      applyDecision: "allow_apply",
      governanceAdvisoryStatus: "governance_supported",
      advisorySeverity: "low",
    },
    recommendation: {
      type: "prefer_fast_voice_for_short_replies",
      originalConfidence: "medium",
      shapedConfidence: "medium",
      priority: "normal",
      trustScore: 0.55,
      biasStatus: "historically_risky",
    },
  });

  const readiness = determineVoiceApprovalReadiness(routing, packet);

  // Even with healthy status and governance_supported, low trustScore should trigger needs_observation
  if (readiness.readinessStatus !== "needs_more_observation") {
    throw new Error(`Expected needs_more_observation for low trustScore, got ${readiness.readinessStatus}`);
  }
  if (readiness.approvalEligible !== false) {
    throw new Error("Expected approvalEligible to be false for low trustScore");
  }

  console.log("✅ testLowTrustScoreTriggersNeedsObservation passed");
}

// ============================================================================
// TEST 13 — summary_contains_meaningful_text
// ============================================================================

function testSummaryContainsMeaningfulText() {
  const routing = makeRoutingDecision({ route: "immediate_human_review" });
  const packet = makeReviewPacket({ status: "blocked" });

  const readiness = determineVoiceApprovalReadiness(routing, packet);

  if (readiness.summary.length < 20) {
    throw new Error("Summary should be meaningful and descriptive");
  }
  if (readiness.operatorGuidance.length < 20) {
    throw new Error("Operator guidance should be meaningful and descriptive");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// TEST 14 — reasons_and_warnings_are_deduplicated_and_sorted
// ============================================================================

function testReasonsAndWarningsAreDeduplicatedAndSorted() {
  const routing = makeRoutingDecision({
    route: "priority_operator_review",
    reasons: ["duplicate_item", "routing_reason"],
    warnings: ["duplicate_item", "routing_warning"],
  });
  const packet = makeReviewPacket({
    status: "degraded",
    reasons: ["duplicate_item", "packet_reason"],
    warnings: ["duplicate_item", "packet_warning"],
  });

  const readiness = determineVoiceApprovalReadiness(routing, packet);

  // Check no duplicates
  const reasonsSet = new Set(readiness.reasons);
  if (readiness.reasons.length !== reasonsSet.size) {
    throw new Error(`Reasons should have no duplicates, got ${readiness.reasons.length} with ${reasonsSet.size} unique`);
  }

  const warningsSet = new Set(readiness.warnings);
  if (readiness.warnings.length !== warningsSet.size) {
    throw new Error(`Warnings should have no duplicates, got ${readiness.warnings.length} with ${warningsSet.size} unique`);
  }

  // Check sorted
  const sortedReasons = [...readiness.reasons].sort();
  if (JSON.stringify(readiness.reasons) !== JSON.stringify(sortedReasons)) {
    throw new Error("Reasons should be sorted");
  }

  const sortedWarnings = [...readiness.warnings].sort();
  if (JSON.stringify(readiness.warnings) !== JSON.stringify(sortedWarnings)) {
    throw new Error("Warnings should be sorted");
  }

  console.log("✅ testReasonsAndWarningsAreDeduplicatedAndSorted passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Approval Readiness Tests ===\n");

try {
  testMarksBlockedCaseAsNotReady();
  testMarksRiskFlaggedCaseAsNotReady();
  testMarksPriorityReviewCaseAsNeedingObservation();
  testMarksObservationOnlyCaseAsNeedingObservation();
  testMarksHealthySupportedCaseAsReady();
  testSetsApprovalEligibleCorrectly();
  testSetsEvidenceSufficiencyCorrectly();
  testIncludesReasonsAndWarnings();
  testFormatsOutputCorrectly();
  testDoesNotMutateInputs();
  testReturnsDeterministicOutput();
  testLowTrustScoreTriggersNeedsObservation();
  testSummaryContainsMeaningfulText();
  testReasonsAndWarningsAreDeduplicatedAndSorted();

  console.log("\n✅ All voice approval readiness tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
