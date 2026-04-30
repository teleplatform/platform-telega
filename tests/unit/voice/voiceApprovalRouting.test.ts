import {
  determineVoiceApprovalRoute,
  formatVoiceApprovalRoutingDecision,
  type VoiceApprovalRoutingDecision,
} from "../../../src/telegram/voiceApprovalRouting.js";
import type { VoiceOperatorPriorityDecision } from "../../../src/telegram/voiceOperatorPrioritization.js";
import type { VoiceTrustAwareReviewPacket } from "../../../src/telegram/voiceTrustAwareReviewPacket.js";

// ============================================================================
// Helpers
// ============================================================================

function makePriorityDecision(
  overrides: Partial<VoiceOperatorPriorityDecision>,
): VoiceOperatorPriorityDecision {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    priority: overrides.priority ?? "p3_low",
    escalationRequired: overrides.escalationRequired ?? false,
    queueBucket: overrides.queueBucket ?? "archive",
    summary: overrides.summary ?? "Low operator priority — trust-aware voice runtime appears healthy.",
    operatorRoutingHint: overrides.operatorRoutingHint ?? "No immediate review needed.",
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
// TEST 1 — routes_p0_to_immediate_human_review
// ============================================================================

function testRoutesP0ToImmediateHumanReview() {
  const priority = makePriorityDecision({ priority: "p0_immediate" });
  const packet = makeReviewPacket({ status: "blocked" });

  const route = determineVoiceApprovalRoute(priority, packet);

  if (route.route !== "immediate_human_review") {
    throw new Error(`Expected immediate_human_review, got ${route.route}`);
  }
  if (route.approvalRequired !== true) {
    throw new Error("Expected approvalRequired to be true for P0");
  }
  if (route.targetLane !== "incident_lane") {
    throw new Error(`Expected incident_lane, got ${route.targetLane}`);
  }

  console.log("✅ testRoutesP0ToImmediateHumanReview passed");
}

// ============================================================================
// TEST 2 — routes_p1_to_priority_operator_review
// ============================================================================

function testRoutesP1ToPriorityOperatorReview() {
  const priority = makePriorityDecision({ priority: "p1_high" });
  const packet = makeReviewPacket({ status: "degraded" });

  const route = determineVoiceApprovalRoute(priority, packet);

  if (route.route !== "priority_operator_review") {
    throw new Error(`Expected priority_operator_review, got ${route.route}`);
  }
  if (route.approvalRequired !== true) {
    throw new Error("Expected approvalRequired to be true for P1");
  }
  if (route.targetLane !== "review_lane") {
    throw new Error(`Expected review_lane, got ${route.targetLane}`);
  }

  console.log("✅ testRoutesP1ToPriorityOperatorReview passed");
}

// ============================================================================
// TEST 3 — routes_p2_to_observation_only
// ============================================================================

function testRoutesP2ToObservationOnly() {
  const priority = makePriorityDecision({ priority: "p2_normal" });
  const packet = makeReviewPacket({ status: "watch" });

  const route = determineVoiceApprovalRoute(priority, packet);

  if (route.route !== "observation_only") {
    throw new Error(`Expected observation_only, got ${route.route}`);
  }
  if (route.approvalRequired !== false) {
    throw new Error("Expected approvalRequired to be false for P2");
  }
  if (route.targetLane !== "observation_lane") {
    throw new Error(`Expected observation_lane, got ${route.targetLane}`);
  }

  console.log("✅ testRoutesP2ToObservationOnly passed");
}

// ============================================================================
// TEST 4 — routes_p3_to_passive_archive
// ============================================================================

function testRoutesP3ToPassiveArchive() {
  const priority = makePriorityDecision({ priority: "p3_low" });
  const packet = makeReviewPacket({ status: "healthy" });

  const route = determineVoiceApprovalRoute(priority, packet);

  if (route.route !== "passive_archive") {
    throw new Error(`Expected passive_archive, got ${route.route}`);
  }
  if (route.approvalRequired !== false) {
    throw new Error("Expected approvalRequired to be false for P3");
  }
  if (route.targetLane !== "archive_lane") {
    throw new Error(`Expected archive_lane, got ${route.targetLane}`);
  }

  console.log("✅ testRoutesP3ToPassiveArchive passed");
}

// ============================================================================
// TEST 5 — sets_approval_required_correctly
// ============================================================================

function testSetsApprovalRequiredCorrectly() {
  const p0Priority = makePriorityDecision({ priority: "p0_immediate" });
  const p1Priority = makePriorityDecision({ priority: "p1_high" });
  const p2Priority = makePriorityDecision({ priority: "p2_normal" });
  const p3Priority = makePriorityDecision({ priority: "p3_low" });

  const packet = makeReviewPacket({});

  const p0Route = determineVoiceApprovalRoute(p0Priority, packet);
  const p1Route = determineVoiceApprovalRoute(p1Priority, packet);
  const p2Route = determineVoiceApprovalRoute(p2Priority, packet);
  const p3Route = determineVoiceApprovalRoute(p3Priority, packet);

  if (p0Route.approvalRequired !== true) {
    throw new Error("P0 should require approval");
  }
  if (p1Route.approvalRequired !== true) {
    throw new Error("P1 should require approval");
  }
  if (p2Route.approvalRequired !== false) {
    throw new Error("P2 should NOT require approval");
  }
  if (p3Route.approvalRequired !== false) {
    throw new Error("P3 should NOT require approval");
  }

  console.log("✅ testSetsApprovalRequiredCorrectly passed");
}

// ============================================================================
// TEST 6 — sets_target_lane_correctly
// ============================================================================

function testSetsTargetLaneCorrectly() {
  const p0Priority = makePriorityDecision({ priority: "p0_immediate" });
  const p1Priority = makePriorityDecision({ priority: "p1_high" });
  const p2Priority = makePriorityDecision({ priority: "p2_normal" });
  const p3Priority = makePriorityDecision({ priority: "p3_low" });

  const packet = makeReviewPacket({});

  const p0Route = determineVoiceApprovalRoute(p0Priority, packet);
  const p1Route = determineVoiceApprovalRoute(p1Priority, packet);
  const p2Route = determineVoiceApprovalRoute(p2Priority, packet);
  const p3Route = determineVoiceApprovalRoute(p3Priority, packet);

  if (p0Route.targetLane !== "incident_lane") {
    throw new Error(`Expected incident_lane for P0, got ${p0Route.targetLane}`);
  }
  if (p1Route.targetLane !== "review_lane") {
    throw new Error(`Expected review_lane for P1, got ${p1Route.targetLane}`);
  }
  if (p2Route.targetLane !== "observation_lane") {
    throw new Error(`Expected observation_lane for P2, got ${p2Route.targetLane}`);
  }
  if (p3Route.targetLane !== "archive_lane") {
    throw new Error(`Expected archive_lane for P3, got ${p3Route.targetLane}`);
  }

  console.log("✅ testSetsTargetLaneCorrectly passed");
}

// ============================================================================
// TEST 7 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const p0Priority = makePriorityDecision({ priority: "p0_immediate" });
  const p1Priority = makePriorityDecision({ priority: "p1_high" });
  const p2Priority = makePriorityDecision({ priority: "p2_normal" });
  const p3Priority = makePriorityDecision({ priority: "p3_low" });

  const packet = makeReviewPacket({});

  const p0Route = determineVoiceApprovalRoute(p0Priority, packet);
  const p1Route = determineVoiceApprovalRoute(p1Priority, packet);
  const p2Route = determineVoiceApprovalRoute(p2Priority, packet);
  const p3Route = determineVoiceApprovalRoute(p3Priority, packet);

  // P0 should have reasons and warnings
  if (p0Route.reasons.length === 0) {
    throw new Error("P0 route should include reasons");
  }
  if (p0Route.warnings.length === 0) {
    throw new Error("P0 route should include warnings");
  }

  // P1 should have reasons and warnings
  if (p1Route.reasons.length === 0) {
    throw new Error("P1 route should include reasons");
  }
  if (p1Route.warnings.length === 0) {
    throw new Error("P1 route should include warnings");
  }

  // P2 should have reasons and warnings
  if (p2Route.reasons.length === 0) {
    throw new Error("P2 route should include reasons");
  }
  if (p2Route.warnings.length === 0) {
    throw new Error("P2 route should include warnings");
  }

  // P3 should have reasons (warnings can be empty for healthy cases)
  if (p3Route.reasons.length === 0) {
    throw new Error("P3 route should include reasons");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 8 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const priority = makePriorityDecision({ priority: "p0_immediate" });
  const packet = makeReviewPacket({ status: "blocked" });

  const route = determineVoiceApprovalRoute(priority, packet);
  const formatted = formatVoiceApprovalRoutingDecision(route);

  if (!formatted.includes("🧭 Voice Approval Routing")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("route:")) {
    throw new Error("Missing route in formatted output");
  }
  if (!formatted.includes("approval required:")) {
    throw new Error("Missing approval required in formatted output");
  }
  if (!formatted.includes("target lane:")) {
    throw new Error("Missing target lane in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("routing reason:")) {
    throw new Error("Missing routing reason in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 9 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const priority = makePriorityDecision({
    priority: "p1_high",
    reasons: ["reason_a", "reason_b"],
    warnings: ["warning_a"],
  });
  const packet = makeReviewPacket({
    status: "degraded",
    reasons: ["packet_reason"],
    warnings: ["packet_warning"],
  });

  const route1 = determineVoiceApprovalRoute(priority, packet);
  const route2 = determineVoiceApprovalRoute(priority, packet);

  // Strip generatedAtMs for comparison
  const r1 = { ...route1, generatedAtMs: 0 };
  const r2 = { ...route2, generatedAtMs: 0 };

  if (JSON.stringify(r1) !== JSON.stringify(r2)) {
    throw new Error("Approval routing decision should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_inputs
// ============================================================================

function testDoesNotMutateInputs() {
  const priority = makePriorityDecision({
    priority: "p0_immediate",
    reasons: ["original_reason"],
    warnings: ["original_warning"],
  });
  const packet = makeReviewPacket({
    status: "blocked",
    reasons: ["packet_reason"],
    warnings: ["packet_warning"],
  });

  const originalPriority = JSON.stringify(priority);
  const originalPacket = JSON.stringify(packet);

  determineVoiceApprovalRoute(priority, packet);

  if (JSON.stringify(priority) !== originalPriority) {
    throw new Error("Priority decision should not be mutated");
  }
  if (JSON.stringify(packet) !== originalPacket) {
    throw new Error("Review packet should not be mutated");
  }

  console.log("✅ testDoesNotMutateInputs passed");
}

// ============================================================================
// TEST 11 — summary_contains_meaningful_text
// ============================================================================

function testSummaryContainsMeaningfulText() {
  const priority = makePriorityDecision({ priority: "p0_immediate" });
  const packet = makeReviewPacket({ status: "blocked" });

  const route = determineVoiceApprovalRoute(priority, packet);

  if (route.summary.length < 20) {
    throw new Error("Summary should be meaningful and descriptive");
  }
  if (route.routingReason.length < 20) {
    throw new Error("Routing reason should be meaningful and descriptive");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// TEST 12 — routing_reason_explains_decision
// ============================================================================

function testRoutingReasonExplainsDecision() {
  const p0Priority = makePriorityDecision({ priority: "p0_immediate" });
  const p1Priority = makePriorityDecision({ priority: "p1_high" });
  const p2Priority = makePriorityDecision({ priority: "p2_normal" });
  const p3Priority = makePriorityDecision({ priority: "p3_low" });

  const packet = makeReviewPacket({});

  const p0Route = determineVoiceApprovalRoute(p0Priority, packet);
  const p1Route = determineVoiceApprovalRoute(p1Priority, packet);
  const p2Route = determineVoiceApprovalRoute(p2Priority, packet);
  const p3Route = determineVoiceApprovalRoute(p3Priority, packet);

  if (!p0Route.routingReason.toLowerCase().includes("p0")) {
    throw new Error("P0 routing reason should mention P0");
  }
  if (!p1Route.routingReason.toLowerCase().includes("p1")) {
    throw new Error("P1 routing reason should mention P1");
  }
  if (!p2Route.routingReason.toLowerCase().includes("p2")) {
    throw new Error("P2 routing reason should mention P2");
  }
  if (!p3Route.routingReason.toLowerCase().includes("p3")) {
    throw new Error("P3 routing reason should mention P3");
  }

  console.log("✅ testRoutingReasonExplainsDecision passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Approval Routing Tests ===\n");

try {
  testRoutesP0ToImmediateHumanReview();
  testRoutesP1ToPriorityOperatorReview();
  testRoutesP2ToObservationOnly();
  testRoutesP3ToPassiveArchive();
  testSetsApprovalRequiredCorrectly();
  testSetsTargetLaneCorrectly();
  testIncludesReasonsAndWarnings();
  testFormatsOutputCorrectly();
  testReturnsDeterministicOutput();
  testDoesNotMutateInputs();
  testSummaryContainsMeaningfulText();
  testRoutingReasonExplainsDecision();

  console.log("\n✅ All voice approval routing tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
