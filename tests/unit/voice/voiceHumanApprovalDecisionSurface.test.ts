import {
  buildVoiceHumanApprovalDecisionSurface,
  formatVoiceHumanApprovalDecisionSurface,
  type VoiceHumanApprovalDecisionSurface,
} from "../../../src/telegram/voiceHumanApprovalDecisionSurface.js";
import type { VoiceApprovalReadinessDecision } from "../../../src/telegram/voiceApprovalReadiness.js";
import type { VoiceApprovalRoutingDecision } from "../../../src/telegram/voiceApprovalRouting.js";
import type { VoiceTrustAwareReviewPacket } from "../../../src/telegram/voiceTrustAwareReviewPacket.js";

// ============================================================================
// helpers
// ============================================================================

function makeReadiness(
  overrides: Partial<VoiceApprovalReadinessDecision>,
): VoiceApprovalReadinessDecision {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    readinessStatus: overrides.readinessStatus ?? "ready_for_human_approval",
    approvalEligible: overrides.approvalEligible ?? true,
    evidenceSufficiency: overrides.evidenceSufficiency ?? "high",
    humanApprovalRecommended: overrides.humanApprovalRecommended ?? true,
    summary: overrides.summary ?? "Voice case is sufficiently stable.",
    operatorGuidance: overrides.operatorGuidance ?? "Safe to present for approval.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

function makeRouting(
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

function makeReview(
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

function makeOperatorPriority(priority: string) {
  return { priority };
}

// ============================================================================
// TEST 1 — builds_approval_blocked_for_risk_blocked_readiness
// ============================================================================

function testBuildsApprovalBlockedForRiskBlockedReadiness() {
  const readiness = makeReadiness({
    readinessStatus: "not_ready_risk_blocked",
    approvalEligible: false,
    evidenceSufficiency: "low",
  });
  const routing = makeRouting({ route: "immediate_human_review" });
  const review = makeReview({ status: "blocked" });
  const priority = makeOperatorPriority("p0_immediate");

  const surface = buildVoiceHumanApprovalDecisionSurface(
    readiness,
    routing,
    review,
    priority,
  );

  if (surface.decision !== "approval_blocked") {
    throw new Error(`Expected approval_blocked, got ${surface.decision}`);
  }
  if (surface.approvalEligible !== false) {
    throw new Error("Expected approvalEligible to be false for risk-blocked");
  }
  if (surface.actionMode !== "block_approval") {
    throw new Error(`Expected block_approval, got ${surface.actionMode}`);
  }

  console.log("✅ testBuildsApprovalBlockedForRiskBlockedReadiness passed");
}

// ============================================================================
// TEST 2 — builds_approval_deferred_for_observation_state
// ============================================================================

function testBuildsApprovalDeferredForObservationState() {
  const readiness = makeReadiness({
    readinessStatus: "needs_more_observation",
    approvalEligible: false,
    evidenceSufficiency: "medium",
  });
  const routing = makeRouting({ route: "observation_only" });
  const review = makeReview({ status: "watch" });
  const priority = makeOperatorPriority("p2_normal");

  const surface = buildVoiceHumanApprovalDecisionSurface(
    readiness,
    routing,
    review,
    priority,
  );

  if (surface.decision !== "approval_deferred") {
    throw new Error(`Expected approval_deferred, got ${surface.decision}`);
  }
  if (surface.approvalEligible !== false) {
    throw new Error("Expected approvalEligible to be false for observation");
  }
  if (surface.actionMode !== "observe_only") {
    throw new Error(`Expected observe_only, got ${surface.actionMode}`);
  }

  console.log("✅ testBuildsApprovalDeferredForObservationState passed");
}

// ============================================================================
// TEST 3 — builds_approval_deferred_for_priority_review_route
// ============================================================================

function testBuildsApprovalDeferredForPriorityReviewRoute() {
  const readiness = makeReadiness({
    readinessStatus: "needs_more_observation",
    approvalEligible: false,
    evidenceSufficiency: "medium",
  });
  const routing = makeRouting({ route: "priority_operator_review" });
  const review = makeReview({ status: "degraded" });
  const priority = makeOperatorPriority("p1_high");

  const surface = buildVoiceHumanApprovalDecisionSurface(
    readiness,
    routing,
    review,
    priority,
  );

  if (surface.decision !== "approval_deferred") {
    throw new Error(`Expected approval_deferred for priority review, got ${surface.decision}`);
  }
  if (surface.actionMode !== "observe_only") {
    throw new Error(`Expected observe_only, got ${surface.actionMode}`);
  }

  console.log("✅ testBuildsApprovalDeferredForPriorityReviewRoute passed");
}

// ============================================================================
// TEST 4 — builds_approval_open_for_ready_case
// ============================================================================

function testBuildsApprovalOpenForReadyCase() {
  const readiness = makeReadiness({
    readinessStatus: "ready_for_human_approval",
    approvalEligible: true,
    evidenceSufficiency: "high",
  });
  const routing = makeRouting({ route: "passive_archive" });
  const review = makeReview({
    status: "healthy",
    governance: {
      applyDecision: "allow_apply",
      governanceAdvisoryStatus: "governance_supported",
      advisorySeverity: "low",
    },
  });
  const priority = makeOperatorPriority("p3_low");

  const surface = buildVoiceHumanApprovalDecisionSurface(
    readiness,
    routing,
    review,
    priority,
  );

  if (surface.decision !== "approval_open") {
    throw new Error(`Expected approval_open, got ${surface.decision}`);
  }
  if (surface.approvalEligible !== true) {
    throw new Error("Expected approvalEligible to be true for ready case");
  }
  if (surface.actionMode !== "approve_if_needed") {
    throw new Error(`Expected approve_if_needed, got ${surface.actionMode}`);
  }

  console.log("✅ testBuildsApprovalOpenForReadyCase passed");
}

// ============================================================================
// TEST 5 — sets_action_mode_correctly
// ============================================================================

function testSetsActionModeCorrectly() {
  const blockedReadiness = makeReadiness({
    readinessStatus: "not_ready_risk_blocked",
    approvalEligible: false,
  });
  const blockedRouting = makeRouting({ route: "immediate_human_review" });

  const deferredReadiness = makeReadiness({
    readinessStatus: "needs_more_observation",
    approvalEligible: false,
  });
  const deferredRouting = makeRouting({ route: "observation_only" });

  const openReadiness = makeReadiness({
    readinessStatus: "ready_for_human_approval",
    approvalEligible: true,
  });
  const openRouting = makeRouting({ route: "passive_archive" });

  const review = makeReview({});
  const priority = makeOperatorPriority("p3_low");

  const blockedSurface = buildVoiceHumanApprovalDecisionSurface(
    blockedReadiness,
    blockedRouting,
    review,
    priority,
  );
  const deferredSurface = buildVoiceHumanApprovalDecisionSurface(
    deferredReadiness,
    deferredRouting,
    review,
    priority,
  );
  const openSurface = buildVoiceHumanApprovalDecisionSurface(
    openReadiness,
    openRouting,
    review,
    priority,
  );

  if (blockedSurface.actionMode !== "block_approval") {
    throw new Error(`Expected block_approval, got ${blockedSurface.actionMode}`);
  }
  if (deferredSurface.actionMode !== "observe_only") {
    throw new Error(`Expected observe_only, got ${deferredSurface.actionMode}`);
  }
  if (openSurface.actionMode !== "approve_if_needed") {
    throw new Error(`Expected approve_if_needed, got ${openSurface.actionMode}`);
  }

  console.log("✅ testSetsActionModeCorrectly passed");
}

// ============================================================================
// TEST 6 — propagates_route_priority_and_evidence
// ============================================================================

function testPropagatesRoutePriorityAndEvidence() {
  const readiness = makeReadiness({
    readinessStatus: "ready_for_human_approval",
    approvalEligible: true,
    evidenceSufficiency: "high",
  });
  const routing = makeRouting({ route: "passive_archive" });
  const review = makeReview({});
  const priority = makeOperatorPriority("p3_low");

  const surface = buildVoiceHumanApprovalDecisionSurface(
    readiness,
    routing,
    review,
    priority,
  );

  if (surface.route !== "passive_archive") {
    throw new Error(`Expected route passive_archive, got ${surface.route}`);
  }
  if (surface.priority !== "p3_low") {
    throw new Error(`Expected priority p3_low, got ${surface.priority}`);
  }
  if (surface.evidenceSufficiency !== "high") {
    throw new Error(`Expected evidenceSufficiency high, got ${surface.evidenceSufficiency}`);
  }

  console.log("✅ testPropagatesRoutePriorityAndEvidence passed");
}

// ============================================================================
// TEST 7 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const readiness = makeReadiness({
    readinessStatus: "not_ready_risk_blocked",
    approvalEligible: false,
    reasons: ["readiness_reason_a"],
    warnings: ["readiness_warning_a"],
  });
  const routing = makeRouting({
    route: "immediate_human_review",
    reasons: ["routing_reason_a"],
    warnings: ["routing_warning_a"],
  });
  const review = makeReview({
    status: "blocked",
    reasons: ["review_reason_a"],
    warnings: ["review_warning_a"],
  });
  const priority = makeOperatorPriority("p0_immediate");

  const surface = buildVoiceHumanApprovalDecisionSurface(
    readiness,
    routing,
    review,
    priority,
  );

  if (surface.reasons.length === 0) {
    throw new Error("Surface should include reasons");
  }
  if (surface.warnings.length === 0) {
    throw new Error("Surface should include warnings");
  }

  // Check that sources are merged
  if (!surface.reasons.some((r) => r.includes("readiness_reason_a"))) {
    throw new Error("Surface should include readiness reasons");
  }
  if (!surface.reasons.some((r) => r.includes("routing_reason_a"))) {
    throw new Error("Surface should include routing reasons");
  }
  if (!surface.reasons.some((r) => r.includes("review_reason_a"))) {
    throw new Error("Surface should include review reasons");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 8 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const readiness = makeReadiness({
    readinessStatus: "ready_for_human_approval",
    approvalEligible: true,
  });
  const routing = makeRouting({ route: "passive_archive" });
  const review = makeReview({});
  const priority = makeOperatorPriority("p3_low");

  const surface = buildVoiceHumanApprovalDecisionSurface(
    readiness,
    routing,
    review,
    priority,
  );
  const formatted = formatVoiceHumanApprovalDecisionSurface(surface);

  if (!formatted.includes("🧾 Voice Human Approval Decision")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("decision:")) {
    throw new Error("Missing decision in formatted output");
  }
  if (!formatted.includes("approval eligible:")) {
    throw new Error("Missing approval eligible in formatted output");
  }
  if (!formatted.includes("action mode:")) {
    throw new Error("Missing action mode in formatted output");
  }
  if (!formatted.includes("route:")) {
    throw new Error("Missing route in formatted output");
  }
  if (!formatted.includes("priority:")) {
    throw new Error("Missing priority in formatted output");
  }
  if (!formatted.includes("evidence sufficiency:")) {
    throw new Error("Missing evidence sufficiency in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("operator instruction:")) {
    throw new Error("Missing operator instruction in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 9 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const readiness = makeReadiness({
    readinessStatus: "needs_more_observation",
    approvalEligible: false,
    reasons: ["reason_a", "reason_b"],
    warnings: ["warning_a"],
  });
  const routing = makeRouting({
    route: "observation_only",
    reasons: ["routing_reason"],
    warnings: ["routing_warning"],
  });
  const review = makeReview({
    status: "watch",
    reasons: ["review_reason"],
    warnings: ["review_warning"],
  });
  const priority = makeOperatorPriority("p2_normal");

  const surface1 = buildVoiceHumanApprovalDecisionSurface(
    readiness,
    routing,
    review,
    priority,
  );
  const surface2 = buildVoiceHumanApprovalDecisionSurface(
    readiness,
    routing,
    review,
    priority,
  );

  // Strip generatedAtMs for comparison
  const s1 = { ...surface1, generatedAtMs: 0 };
  const s2 = { ...surface2, generatedAtMs: 0 };

  if (JSON.stringify(s1) !== JSON.stringify(s2)) {
    throw new Error("Decision surface should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_inputs
// ============================================================================

function testDoesNotMutateInputs() {
  const readiness = makeReadiness({
    readinessStatus: "not_ready_risk_blocked",
    approvalEligible: false,
    reasons: ["readiness_reason"],
    warnings: ["readiness_warning"],
  });
  const routing = makeRouting({
    route: "immediate_human_review",
    reasons: ["routing_reason"],
    warnings: ["routing_warning"],
  });
  const review = makeReview({
    status: "blocked",
    reasons: ["review_reason"],
    warnings: ["review_warning"],
  });
  const priority = makeOperatorPriority("p0_immediate");

  const originalReadiness = JSON.stringify(readiness);
  const originalRouting = JSON.stringify(routing);
  const originalReview = JSON.stringify(review);

  buildVoiceHumanApprovalDecisionSurface(readiness, routing, review, priority);

  if (JSON.stringify(readiness) !== originalReadiness) {
    throw new Error("Readiness decision should not be mutated");
  }
  if (JSON.stringify(routing) !== originalRouting) {
    throw new Error("Routing decision should not be mutated");
  }
  if (JSON.stringify(review) !== originalReview) {
    throw new Error("Review packet should not be mutated");
  }

  console.log("✅ testDoesNotMutateInputs passed");
}

// ============================================================================
// TEST 11 — summary_contains_meaningful_text
// ============================================================================

function testSummaryContainsMeaningfulText() {
  const readiness = makeReadiness({
    readinessStatus: "not_ready_risk_blocked",
    approvalEligible: false,
  });
  const routing = makeRouting({ route: "immediate_human_review" });
  const review = makeReview({ status: "blocked" });
  const priority = makeOperatorPriority("p0_immediate");

  const surface = buildVoiceHumanApprovalDecisionSurface(
    readiness,
    routing,
    review,
    priority,
  );

  if (surface.summary.length < 20) {
    throw new Error("Summary should be meaningful and descriptive");
  }
  if (surface.operatorInstruction.length < 20) {
    throw new Error("Operator instruction should be meaningful and descriptive");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// TEST 12 — reasons_and_warnings_are_deduplicated_and_sorted
// ============================================================================

function testReasonsAndWarningsAreDeduplicatedAndSorted() {
  const readiness = makeReadiness({
    readinessStatus: "needs_more_observation",
    approvalEligible: false,
    reasons: ["duplicate_item", "readiness_reason"],
    warnings: ["duplicate_item", "readiness_warning"],
  });
  const routing = makeRouting({
    route: "priority_operator_review",
    reasons: ["duplicate_item", "routing_reason"],
    warnings: ["duplicate_item", "routing_warning"],
  });
  const review = makeReview({
    status: "degraded",
    reasons: ["duplicate_item", "review_reason"],
    warnings: ["duplicate_item", "review_warning"],
  });
  const priority = makeOperatorPriority("p1_high");

  const surface = buildVoiceHumanApprovalDecisionSurface(
    readiness,
    routing,
    review,
    priority,
  );

  // Check no duplicates
  const reasonsSet = new Set(surface.reasons);
  if (surface.reasons.length !== reasonsSet.size) {
    throw new Error(`Reasons should have no duplicates, got ${surface.reasons.length} with ${reasonsSet.size} unique`);
  }

  const warningsSet = new Set(surface.warnings);
  if (surface.warnings.length !== warningsSet.size) {
    throw new Error(`Warnings should have no duplicates, got ${surface.warnings.length} with ${warningsSet.size} unique`);
  }

  // Check sorted
  const sortedReasons = [...surface.reasons].sort();
  if (JSON.stringify(surface.reasons) !== JSON.stringify(sortedReasons)) {
    throw new Error("Reasons should be sorted");
  }

  const sortedWarnings = [...surface.warnings].sort();
  if (JSON.stringify(surface.warnings) !== JSON.stringify(sortedWarnings)) {
    throw new Error("Warnings should be sorted");
  }

  console.log("✅ testReasonsAndWarningsAreDeduplicatedAndSorted passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Human Approval Decision Surface Tests ===\n");

try {
  testBuildsApprovalBlockedForRiskBlockedReadiness();
  testBuildsApprovalDeferredForObservationState();
  testBuildsApprovalDeferredForPriorityReviewRoute();
  testBuildsApprovalOpenForReadyCase();
  testSetsActionModeCorrectly();
  testPropagatesRoutePriorityAndEvidence();
  testIncludesReasonsAndWarnings();
  testFormatsOutputCorrectly();
  testReturnsDeterministicOutput();
  testDoesNotMutateInputs();
  testSummaryContainsMeaningfulText();
  testReasonsAndWarningsAreDeduplicatedAndSorted();

  console.log("\n✅ All voice human approval decision surface tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
