import {
  determineVoiceWorkflowRecheckScheduling,
  formatVoiceWorkflowRecheckScheduling,
  type VoiceWorkflowRecheckScheduling,
} from "../../../src/telegram/voiceWorkflowRecheckScheduling.js";
import type { VoicePostDecisionWorkflowState } from "../../../src/telegram/voicePostDecisionWorkflowState.js";

// ============================================================================
// helpers
// ============================================================================

function makeWorkflow(
  overrides: Partial<VoicePostDecisionWorkflowState>,
): VoicePostDecisionWorkflowState {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    workflowState: overrides.workflowState ?? "awaiting_human_approval",
    terminal: overrides.terminal ?? false,
    nextCheckRecommended: overrides.nextCheckRecommended ?? true,
    nextCheckMode: overrides.nextCheckMode ?? "await_human_action",
    summary: overrides.summary ?? "Voice case workflow state.",
    workflowInstruction: overrides.workflowInstruction ?? "Hold current state.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

// ============================================================================
// TEST 1 — maps_risk_block_to_immediate_retry
// ============================================================================

function testMapsRiskBlockToImmediateRetry() {
  const workflow = makeWorkflow({ workflowState: "risk_block_recovery" });

  const scheduling = determineVoiceWorkflowRecheckScheduling(workflow);

  if (scheduling.strategy !== "immediate_retry") {
    throw new Error(`Expected immediate_retry, got ${scheduling.strategy}`);
  }
  if (scheduling.nextCheckDelayMs !== 5_000) {
    throw new Error(`Expected 5000ms delay, got ${scheduling.nextCheckDelayMs}`);
  }
  if (scheduling.urgency !== "high") {
    throw new Error(`Expected high urgency, got ${scheduling.urgency}`);
  }

  console.log("✅ testMapsRiskBlockToImmediateRetry passed");
}

// ============================================================================
// TEST 2 — maps_observation_hold_to_short_interval
// ============================================================================

function testMapsObservationHoldToShortInterval() {
  const workflow = makeWorkflow({ workflowState: "observation_hold" });

  const scheduling = determineVoiceWorkflowRecheckScheduling(workflow);

  if (scheduling.strategy !== "short_interval") {
    throw new Error(`Expected short_interval, got ${scheduling.strategy}`);
  }
  if (scheduling.nextCheckDelayMs !== 30_000) {
    throw new Error(`Expected 30000ms delay, got ${scheduling.nextCheckDelayMs}`);
  }
  if (scheduling.urgency !== "medium") {
    throw new Error(`Expected medium urgency, got ${scheduling.urgency}`);
  }

  console.log("✅ testMapsObservationHoldToShortInterval passed");
}

// ============================================================================
// TEST 3 — maps_awaiting_human_to_medium_interval
// ============================================================================

function testMapsAwaitingHumanToMediumInterval() {
  const workflow = makeWorkflow({ workflowState: "awaiting_human_approval" });

  const scheduling = determineVoiceWorkflowRecheckScheduling(workflow);

  if (scheduling.strategy !== "medium_interval") {
    throw new Error(`Expected medium_interval, got ${scheduling.strategy}`);
  }
  if (scheduling.nextCheckDelayMs !== 120_000) {
    throw new Error(`Expected 120000ms delay, got ${scheduling.nextCheckDelayMs}`);
  }
  if (scheduling.urgency !== "low") {
    throw new Error(`Expected low urgency, got ${scheduling.urgency}`);
  }

  console.log("✅ testMapsAwaitingHumanToMediumInterval passed");
}

// ============================================================================
// TEST 4 — maps_passive_monitoring_to_long_interval
// ============================================================================

function testMapsPassiveMonitoringToLongInterval() {
  const workflow = makeWorkflow({
    workflowState: "passive_monitoring",
    nextCheckRecommended: true,
  });

  const scheduling = determineVoiceWorkflowRecheckScheduling(workflow);

  if (scheduling.strategy !== "long_interval") {
    throw new Error(`Expected long_interval, got ${scheduling.strategy}`);
  }
  if (scheduling.nextCheckDelayMs !== 300_000) {
    throw new Error(`Expected 300000ms delay, got ${scheduling.nextCheckDelayMs}`);
  }
  if (scheduling.urgency !== "none") {
    throw new Error(`Expected none urgency, got ${scheduling.urgency}`);
  }

  console.log("✅ testMapsPassiveMonitoringToLongInterval passed");
}

// ============================================================================
// TEST 5 — sets_urgency_correctly
// ============================================================================

function testSetsUrgencyCorrectly() {
  const riskWorkflow = makeWorkflow({ workflowState: "risk_block_recovery" });
  const obsWorkflow = makeWorkflow({ workflowState: "observation_hold" });
  const humanWorkflow = makeWorkflow({ workflowState: "awaiting_human_approval" });
  const passiveWorkflow = makeWorkflow({
    workflowState: "passive_monitoring",
    nextCheckRecommended: true,
  });

  const riskScheduling = determineVoiceWorkflowRecheckScheduling(riskWorkflow);
  const obsScheduling = determineVoiceWorkflowRecheckScheduling(obsWorkflow);
  const humanScheduling = determineVoiceWorkflowRecheckScheduling(humanWorkflow);
  const passiveScheduling = determineVoiceWorkflowRecheckScheduling(passiveWorkflow);

  if (riskScheduling.urgency !== "high") {
    throw new Error(`Expected high for risk, got ${riskScheduling.urgency}`);
  }
  if (obsScheduling.urgency !== "medium") {
    throw new Error(`Expected medium for observation, got ${obsScheduling.urgency}`);
  }
  if (humanScheduling.urgency !== "low") {
    throw new Error(`Expected low for human approval, got ${humanScheduling.urgency}`);
  }
  if (passiveScheduling.urgency !== "none") {
    throw new Error(`Expected none for passive, got ${passiveScheduling.urgency}`);
  }

  console.log("✅ testSetsUrgencyCorrectly passed");
}

// ============================================================================
// TEST 6 — sets_delay_correctly
// ============================================================================

function testSetsDelayCorrectly() {
  const riskWorkflow = makeWorkflow({ workflowState: "risk_block_recovery" });
  const obsWorkflow = makeWorkflow({ workflowState: "observation_hold" });
  const humanWorkflow = makeWorkflow({ workflowState: "awaiting_human_approval" });
  const passiveWorkflow = makeWorkflow({
    workflowState: "passive_monitoring",
    nextCheckRecommended: true,
  });

  const riskScheduling = determineVoiceWorkflowRecheckScheduling(riskWorkflow);
  const obsScheduling = determineVoiceWorkflowRecheckScheduling(obsWorkflow);
  const humanScheduling = determineVoiceWorkflowRecheckScheduling(humanWorkflow);
  const passiveScheduling = determineVoiceWorkflowRecheckScheduling(passiveWorkflow);

  if (riskScheduling.nextCheckDelayMs !== 5_000) {
    throw new Error(`Expected 5000ms for risk, got ${riskScheduling.nextCheckDelayMs}`);
  }
  if (obsScheduling.nextCheckDelayMs !== 30_000) {
    throw new Error(`Expected 30000ms for observation, got ${obsScheduling.nextCheckDelayMs}`);
  }
  if (humanScheduling.nextCheckDelayMs !== 120_000) {
    throw new Error(`Expected 120000ms for human, got ${humanScheduling.nextCheckDelayMs}`);
  }
  if (passiveScheduling.nextCheckDelayMs !== 300_000) {
    throw new Error(`Expected 300000ms for passive, got ${passiveScheduling.nextCheckDelayMs}`);
  }

  console.log("✅ testSetsDelayCorrectly passed");
}

// ============================================================================
// TEST 7 — handles_null_delay_case
// ============================================================================

function testHandlesNullDelayCase() {
  // Passive monitoring with nextCheckRecommended = false → no_recheck
  const passiveNoRecheck = makeWorkflow({
    workflowState: "passive_monitoring",
    nextCheckRecommended: false,
  });

  const scheduling = determineVoiceWorkflowRecheckScheduling(passiveNoRecheck);

  if (scheduling.strategy !== "no_recheck") {
    throw new Error(`Expected no_recheck, got ${scheduling.strategy}`);
  }
  if (scheduling.nextCheckDelayMs !== null) {
    throw new Error(`Expected null delay, got ${scheduling.nextCheckDelayMs}`);
  }

  // Unknown workflow state should also produce no_recheck
  const unknownWorkflow = makeWorkflow({
    workflowState: "unknown_state" as any,
  });

  const unknownScheduling = determineVoiceWorkflowRecheckScheduling(unknownWorkflow);

  if (unknownScheduling.strategy !== "no_recheck") {
    throw new Error(`Expected no_recheck for unknown state, got ${unknownScheduling.strategy}`);
  }
  if (unknownScheduling.nextCheckDelayMs !== null) {
    throw new Error(`Expected null delay for unknown state, got ${unknownScheduling.nextCheckDelayMs}`);
  }

  console.log("✅ testHandlesNullDelayCase passed");
}

// ============================================================================
// TEST 8 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const riskWorkflow = makeWorkflow({
    workflowState: "risk_block_recovery",
    reasons: ["workflow_reason_a"],
    warnings: ["workflow_warning_a"],
  });

  const passiveWorkflow = makeWorkflow({
    workflowState: "passive_monitoring",
    nextCheckRecommended: true,
  });

  const riskScheduling = determineVoiceWorkflowRecheckScheduling(riskWorkflow);
  const passiveScheduling = determineVoiceWorkflowRecheckScheduling(passiveWorkflow);

  // Risk should have reasons and warnings
  if (riskScheduling.reasons.length === 0) {
    throw new Error("Risk scheduling should include reasons");
  }
  if (riskScheduling.warnings.length === 0) {
    throw new Error("Risk scheduling should include warnings");
  }

  // Passive should have reasons
  if (passiveScheduling.reasons.length === 0) {
    throw new Error("Passive scheduling should include reasons");
  }

  // Check source propagation
  if (!riskScheduling.reasons.includes("workflow_reason_a")) {
    throw new Error("Scheduling should propagate workflow reasons");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 9 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const workflow = makeWorkflow({ workflowState: "risk_block_recovery" });
  const scheduling = determineVoiceWorkflowRecheckScheduling(workflow);
  const formatted = formatVoiceWorkflowRecheckScheduling(scheduling);

  if (!formatted.includes("⏱ Voice Workflow Recheck Scheduling")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("strategy:")) {
    throw new Error("Missing strategy in formatted output");
  }
  if (!formatted.includes("next check delay:")) {
    throw new Error("Missing next check delay in formatted output");
  }
  if (!formatted.includes("urgency:")) {
    throw new Error("Missing urgency in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("scheduling instruction:")) {
    throw new Error("Missing scheduling instruction in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_input
// ============================================================================

function testDoesNotMutateInput() {
  const workflow = makeWorkflow({
    workflowState: "observation_hold",
    reasons: ["workflow_reason"],
    warnings: ["workflow_warning"],
  });

  const originalWorkflow = JSON.stringify(workflow);

  determineVoiceWorkflowRecheckScheduling(workflow);

  if (JSON.stringify(workflow) !== originalWorkflow) {
    throw new Error("Input workflow should not be mutated");
  }

  console.log("✅ testDoesNotMutateInput passed");
}

// ============================================================================
// TEST 11 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const workflow = makeWorkflow({
    workflowState: "observation_hold",
    reasons: ["reason_a", "reason_b"],
    warnings: ["warning_a"],
  });

  const s1 = determineVoiceWorkflowRecheckScheduling(workflow);
  const s2 = determineVoiceWorkflowRecheckScheduling(workflow);

  // Strip generatedAtMs for comparison
  const sched1 = { ...s1, generatedAtMs: 0 };
  const sched2 = { ...s2, generatedAtMs: 0 };

  if (JSON.stringify(sched1) !== JSON.stringify(sched2)) {
    throw new Error("Scheduling decision should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 12 — summary_contains_meaningful_text
// ============================================================================

function testSummaryContainsMeaningfulText() {
  const riskWorkflow = makeWorkflow({ workflowState: "risk_block_recovery" });
  const obsWorkflow = makeWorkflow({ workflowState: "observation_hold" });

  const riskScheduling = determineVoiceWorkflowRecheckScheduling(riskWorkflow);
  const obsScheduling = determineVoiceWorkflowRecheckScheduling(obsWorkflow);

  if (riskScheduling.summary.length < 20) {
    throw new Error("Risk scheduling summary should be meaningful");
  }
  if (riskScheduling.schedulingInstruction.length < 20) {
    throw new Error("Risk scheduling instruction should be meaningful");
  }
  if (obsScheduling.summary.length < 20) {
    throw new Error("Observation scheduling summary should be meaningful");
  }
  if (obsScheduling.schedulingInstruction.length < 20) {
    throw new Error("Observation scheduling instruction should be meaningful");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// TEST 13 — reasons_and_warnings_are_deduplicated_and_sorted
// ============================================================================

function testReasonsAndWarningsAreDeduplicatedAndSorted() {
  const workflow = makeWorkflow({
    workflowState: "risk_block_recovery",
    reasons: ["duplicate_item", "workflow_reason"],
    warnings: ["duplicate_item", "workflow_warning"],
  });

  const scheduling = determineVoiceWorkflowRecheckScheduling(workflow);

  // Check no duplicates
  const reasonsSet = new Set(scheduling.reasons);
  if (scheduling.reasons.length !== reasonsSet.size) {
    throw new Error(`Reasons should have no duplicates, got ${scheduling.reasons.length} with ${reasonsSet.size} unique`);
  }

  const warningsSet = new Set(scheduling.warnings);
  if (scheduling.warnings.length !== warningsSet.size) {
    throw new Error(`Warnings should have no duplicates, got ${scheduling.warnings.length} with ${warningsSet.size} unique`);
  }

  // Check sorted
  const sortedReasons = [...scheduling.reasons].sort();
  if (JSON.stringify(scheduling.reasons) !== JSON.stringify(sortedReasons)) {
    throw new Error("Reasons should be sorted");
  }

  const sortedWarnings = [...scheduling.warnings].sort();
  if (JSON.stringify(scheduling.warnings) !== JSON.stringify(sortedWarnings)) {
    throw new Error("Warnings should be sorted");
  }

  console.log("✅ testReasonsAndWarningsAreDeduplicatedAndSorted passed");
}

// ============================================================================
// TEST 14 — formats_null_delay_correctly
// ============================================================================

function testFormatsNullDelayCorrectly() {
  const workflow = makeWorkflow({
    workflowState: "passive_monitoring",
    nextCheckRecommended: false,
  });

  const scheduling = determineVoiceWorkflowRecheckScheduling(workflow);
  const formatted = formatVoiceWorkflowRecheckScheduling(scheduling);

  // Should display "N/A" for null delay
  if (!formatted.includes("N/A")) {
    throw new Error("Null delay should display as N/A");
  }

  console.log("✅ testFormatsNullDelayCorrectly passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Workflow Recheck Scheduling Tests ===\n");

try {
  testMapsRiskBlockToImmediateRetry();
  testMapsObservationHoldToShortInterval();
  testMapsAwaitingHumanToMediumInterval();
  testMapsPassiveMonitoringToLongInterval();
  testSetsUrgencyCorrectly();
  testSetsDelayCorrectly();
  testHandlesNullDelayCase();
  testIncludesReasonsAndWarnings();
  testFormatsOutputCorrectly();
  testDoesNotMutateInput();
  testReturnsDeterministicOutput();
  testSummaryContainsMeaningfulText();
  testReasonsAndWarningsAreDeduplicatedAndSorted();
  testFormatsNullDelayCorrectly();

  console.log("\n✅ All voice workflow recheck scheduling tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
