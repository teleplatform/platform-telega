import {
  evaluateVoiceWorkflowRecheckExecution,
  formatVoiceWorkflowRecheckExecutionGateResult,
  type VoiceWorkflowRecheckExecutionGateResult,
  type EvaluateVoiceWorkflowRecheckExecutionInput,
} from "../../../src/telegram/voiceWorkflowRecheckExecutionGate.js";
import type { VoiceWorkflowRecheckScheduling } from "../../../src/telegram/voiceWorkflowRecheckScheduling.js";

// ============================================================================
// helpers
// ============================================================================

function makeScheduling(
  overrides: Partial<VoiceWorkflowRecheckScheduling>,
): VoiceWorkflowRecheckScheduling {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    strategy: overrides.strategy ?? "medium_interval",
    nextCheckDelayMs: overrides.nextCheckDelayMs ?? 120_000,
    urgency: overrides.urgency ?? "low",
    summary: overrides.summary ?? "Voice case scheduling.",
    schedulingInstruction: overrides.schedulingInstruction ?? "Hold current state.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

function makeInput(
  overrides: Partial<EvaluateVoiceWorkflowRecheckExecutionInput>,
): EvaluateVoiceWorkflowRecheckExecutionInput {
  return {
    scheduling: overrides.scheduling ?? makeScheduling({}),
    nowMs: overrides.nowMs ?? 100_000,
    lastCheckAtMs: overrides.lastCheckAtMs ?? null,
    hasMeaningfulNewSignals: overrides.hasMeaningfulNewSignals ?? true,
    isRecoveryStillActive: overrides.isRecoveryStillActive ?? false,
  };
}

// ============================================================================
// TEST 1 — denies_no_recheck_strategy
// ============================================================================

function testDeniesNoRecheckStrategy() {
  const scheduling = makeScheduling({
    strategy: "no_recheck",
    nextCheckDelayMs: null,
  });
  const input = makeInput({ scheduling });

  const result = evaluateVoiceWorkflowRecheckExecution(input);

  if (result.decision !== "deny_recheck") {
    throw new Error(`Expected deny_recheck, got ${result.decision}`);
  }
  if (result.allowed !== false) {
    throw new Error("Expected allowed to be false for no_recheck");
  }
  if (result.reasonClass !== "still_blocked") {
    throw new Error(`Expected still_blocked, got ${result.reasonClass}`);
  }

  console.log("✅ testDeniesNoRecheckStrategy passed");
}

// ============================================================================
// TEST 2 — denies_when_recovery_still_active_for_non_immediate_strategy
// ============================================================================

function testDeniesWhenRecoveryStillActiveForNonImmediateStrategy() {
  const scheduling = makeScheduling({
    strategy: "short_interval",
  });
  const input = makeInput({
    scheduling,
    isRecoveryStillActive: true,
  });

  const result = evaluateVoiceWorkflowRecheckExecution(input);

  if (result.decision !== "deny_recheck") {
    throw new Error(`Expected deny_recheck when recovery active with non-immediate strategy, got ${result.decision}`);
  }
  if (result.allowed !== false) {
    throw new Error("Expected allowed to be false when recovery active");
  }
  if (result.reasonClass !== "still_blocked") {
    throw new Error(`Expected still_blocked, got ${result.reasonClass}`);
  }

  console.log("✅ testDeniesWhenRecoveryStillActiveForNonImmediateStrategy passed");
}

// ============================================================================
// TEST 3 — holds_when_cooldown_not_elapsed
// ============================================================================

function testHoldsWhenCooldownNotElapsed() {
  const scheduling = makeScheduling({
    strategy: "short_interval",
    nextCheckDelayMs: 30_000,
  });
  // nowMs = 100_000, lastCheckAtMs = 80_000 → elapsed = 20_000 < 30_000
  const input = makeInput({
    scheduling,
    nowMs: 100_000,
    lastCheckAtMs: 80_000,
    hasMeaningfulNewSignals: true,
  });

  const result = evaluateVoiceWorkflowRecheckExecution(input);

  if (result.decision !== "hold_recheck") {
    throw new Error(`Expected hold_recheck, got ${result.decision}`);
  }
  if (result.allowed !== false) {
    throw new Error("Expected allowed to be false during cooldown");
  }
  if (result.reasonClass !== "cooldown_active") {
    throw new Error(`Expected cooldown_active, got ${result.reasonClass}`);
  }

  console.log("✅ testHoldsWhenCooldownNotElapsed passed");
}

// ============================================================================
// TEST 4 — holds_when_no_meaningful_new_signals
// ============================================================================

function testHoldsWhenNoMeaningfulNewSignals() {
  const scheduling = makeScheduling({
    strategy: "medium_interval",
    nextCheckDelayMs: 120_000,
  });
  // No lastCheckAtMs → cooldown not applicable
  const input = makeInput({
    scheduling,
    lastCheckAtMs: null,
    hasMeaningfulNewSignals: false,
  });

  const result = evaluateVoiceWorkflowRecheckExecution(input);

  if (result.decision !== "hold_recheck") {
    throw new Error(`Expected hold_recheck, got ${result.decision}`);
  }
  if (result.allowed !== false) {
    throw new Error("Expected allowed to be false without new signals");
  }
  if (result.reasonClass !== "insufficient_delta") {
    throw new Error(`Expected insufficient_delta, got ${result.reasonClass}`);
  }

  console.log("✅ testHoldsWhenNoMeaningfulNewSignals passed");
}

// ============================================================================
// TEST 5 — allows_when_delay_elapsed_and_new_signals_present
// ============================================================================

function testAllowsWhenDelayElapsedAndNewSignalsPresent() {
  const scheduling = makeScheduling({
    strategy: "medium_interval",
    nextCheckDelayMs: 120_000,
  });
  // nowMs = 250_000, lastCheckAtMs = 100_000 → elapsed = 150_000 > 120_000
  const input = makeInput({
    scheduling,
    nowMs: 250_000,
    lastCheckAtMs: 100_000,
    hasMeaningfulNewSignals: true,
  });

  const result = evaluateVoiceWorkflowRecheckExecution(input);

  if (result.decision !== "allow_recheck") {
    throw new Error(`Expected allow_recheck, got ${result.decision}`);
  }
  if (result.allowed !== true) {
    throw new Error("Expected allowed to be true");
  }
  if (result.reasonClass !== "timing_ok") {
    throw new Error(`Expected timing_ok, got ${result.reasonClass}`);
  }

  console.log("✅ testAllowsWhenDelayElapsedAndNewSignalsPresent passed");
}

// ============================================================================
// TEST 6 — allows_immediate_retry_during_recovery
// ============================================================================

function testAllowsImmediateRetryDuringRecovery() {
  const scheduling = makeScheduling({
    strategy: "immediate_retry",
    nextCheckDelayMs: 5_000,
  });
  const input = makeInput({
    scheduling,
    nowMs: 100_000,
    lastCheckAtMs: null,
    hasMeaningfulNewSignals: true,
    isRecoveryStillActive: true,
  });

  const result = evaluateVoiceWorkflowRecheckExecution(input);

  // immediate_retry strategy should allow recheck even during recovery
  if (result.decision !== "allow_recheck") {
    throw new Error(`Expected allow_recheck for immediate_retry during recovery, got ${result.decision}`);
  }
  if (result.allowed !== true) {
    throw new Error("Expected allowed to be true for immediate_retry");
  }
  if (result.reasonClass !== "timing_ok") {
    throw new Error(`Expected timing_ok, got ${result.reasonClass}`);
  }

  console.log("✅ testAllowsImmediateRetryDuringRecovery passed");
}

// ============================================================================
// TEST 7 — sets_reason_class_correctly
// ============================================================================

function testSetsReasonClassCorrectly() {
  // deny case
  const denyScheduling = makeScheduling({ strategy: "no_recheck" });
  const denyInput = makeInput({ scheduling: denyScheduling });
  const denyResult = evaluateVoiceWorkflowRecheckExecution(denyInput);

  // hold cooldown case
  const holdCooldownScheduling = makeScheduling({
    strategy: "short_interval",
    nextCheckDelayMs: 30_000,
  });
  const holdCooldownInput = makeInput({
    scheduling: holdCooldownScheduling,
    nowMs: 100_000,
    lastCheckAtMs: 80_000,
    hasMeaningfulNewSignals: true,
  });
  const holdCooldownResult = evaluateVoiceWorkflowRecheckExecution(holdCooldownInput);

  // hold insufficient delta case
  const holdDeltaScheduling = makeScheduling({ strategy: "medium_interval" });
  const holdDeltaInput = makeInput({
    scheduling: holdDeltaScheduling,
    lastCheckAtMs: null,
    hasMeaningfulNewSignals: false,
  });
  const holdDeltaResult = evaluateVoiceWorkflowRecheckExecution(holdDeltaInput);

  // allow case
  const allowScheduling = makeScheduling({
    strategy: "medium_interval",
    nextCheckDelayMs: 120_000,
  });
  const allowInput = makeInput({
    scheduling: allowScheduling,
    nowMs: 250_000,
    lastCheckAtMs: 100_000,
    hasMeaningfulNewSignals: true,
  });
  const allowResult = evaluateVoiceWorkflowRecheckExecution(allowInput);

  if (denyResult.reasonClass !== "still_blocked") {
    throw new Error(`Expected still_blocked for deny, got ${denyResult.reasonClass}`);
  }
  if (holdCooldownResult.reasonClass !== "cooldown_active") {
    throw new Error(`Expected cooldown_active for hold, got ${holdCooldownResult.reasonClass}`);
  }
  if (holdDeltaResult.reasonClass !== "insufficient_delta") {
    throw new Error(`Expected insufficient_delta for hold, got ${holdDeltaResult.reasonClass}`);
  }
  if (allowResult.reasonClass !== "timing_ok") {
    throw new Error(`Expected timing_ok for allow, got ${allowResult.reasonClass}`);
  }

  console.log("✅ testSetsReasonClassCorrectly passed");
}

// ============================================================================
// TEST 8 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const scheduling = makeScheduling({
    strategy: "no_recheck",
    reasons: ["scheduling_reason_a"],
    warnings: ["scheduling_warning_a"],
  });
  const input = makeInput({ scheduling });

  const result = evaluateVoiceWorkflowRecheckExecution(input);

  if (result.reasons.length === 0) {
    throw new Error("Result should include reasons");
  }
  if (result.warnings.length === 0) {
    throw new Error("Result should include warnings");
  }

  // Check propagation
  if (!result.reasons.includes("scheduling_reason_a")) {
    throw new Error("Result should propagate scheduling reasons");
  }
  if (!result.warnings.includes("scheduling_warning_a")) {
    throw new Error("Result should propagate scheduling warnings");
  }

  // Check gate-specific reasons
  if (!result.reasons.includes("recheck_strategy_disallows_execution")) {
    throw new Error("Result should include gate-specific reason");
  }
  if (!result.warnings.includes("recheck_execution_must_not_start_yet")) {
    throw new Error("Result should include gate-specific warning");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 9 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const scheduling = makeScheduling({ strategy: "no_recheck" });
  const input = makeInput({ scheduling });

  const result = evaluateVoiceWorkflowRecheckExecution(input);
  const formatted = formatVoiceWorkflowRecheckExecutionGateResult(result);

  if (!formatted.includes("⏱ Voice Recheck Execution Gate")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("decision:")) {
    throw new Error("Missing decision in formatted output");
  }
  if (!formatted.includes("allowed:")) {
    throw new Error("Missing allowed in formatted output");
  }
  if (!formatted.includes("reason class:")) {
    throw new Error("Missing reason class in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("execution instruction:")) {
    throw new Error("Missing execution instruction in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_input
// ============================================================================

function testDoesNotMutateInput() {
  const scheduling = makeScheduling({
    strategy: "short_interval",
    reasons: ["scheduling_reason"],
    warnings: ["scheduling_warning"],
  });
  const input = makeInput({
    scheduling,
    nowMs: 100_000,
    lastCheckAtMs: 80_000,
    hasMeaningfulNewSignals: true,
    isRecoveryStillActive: false,
  });

  const originalInput = JSON.stringify(input);
  const originalScheduling = JSON.stringify(input.scheduling);

  evaluateVoiceWorkflowRecheckExecution(input);

  if (JSON.stringify(input) !== originalInput) {
    throw new Error("Input should not be mutated");
  }
  if (JSON.stringify(input.scheduling) !== originalScheduling) {
    throw new Error("Scheduling should not be mutated");
  }

  console.log("✅ testDoesNotMutateInput passed");
}

// ============================================================================
// TEST 11 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const scheduling = makeScheduling({
    strategy: "medium_interval",
    nextCheckDelayMs: 120_000,
    reasons: ["reason_a", "reason_b"],
    warnings: ["warning_a"],
  });
  const input = makeInput({
    scheduling,
    nowMs: 250_000,
    lastCheckAtMs: 100_000,
    hasMeaningfulNewSignals: true,
  });

  const result1 = evaluateVoiceWorkflowRecheckExecution(input);
  const result2 = evaluateVoiceWorkflowRecheckExecution(input);

  // Strip generatedAtMs for comparison
  const r1 = { ...result1, generatedAtMs: 0 };
  const r2 = { ...result2, generatedAtMs: 0 };

  if (JSON.stringify(r1) !== JSON.stringify(r2)) {
    throw new Error("Execution gate result should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 12 — summary_contains_meaningful_text
// ============================================================================

function testSummaryContainsMeaningfulText() {
  const denyScheduling = makeScheduling({ strategy: "no_recheck" });
  const denyInput = makeInput({ scheduling: denyScheduling });
  const denyResult = evaluateVoiceWorkflowRecheckExecution(denyInput);

  const allowScheduling = makeScheduling({ strategy: "medium_interval" });
  const allowInput = makeInput({
    scheduling: allowScheduling,
    nowMs: 250_000,
    lastCheckAtMs: 100_000,
    hasMeaningfulNewSignals: true,
  });
  const allowResult = evaluateVoiceWorkflowRecheckExecution(allowInput);

  if (denyResult.summary.length < 20) {
    throw new Error("Deny summary should be meaningful and descriptive");
  }
  if (denyResult.executionInstruction.length < 20) {
    throw new Error("Deny execution instruction should be meaningful");
  }
  if (allowResult.summary.length < 20) {
    throw new Error("Allow summary should be meaningful and descriptive");
  }
  if (allowResult.executionInstruction.length < 20) {
    throw new Error("Allow execution instruction should be meaningful");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// TEST 13 — allows_when_no_last_check_and_new_signals_present
// ============================================================================

function testAllowsWhenNoLastCheckAndNewSignalsPresent() {
  const scheduling = makeScheduling({
    strategy: "short_interval",
    nextCheckDelayMs: 30_000,
  });
  // No lastCheckAtMs → cooldown not applicable
  const input = makeInput({
    scheduling,
    lastCheckAtMs: null,
    hasMeaningfulNewSignals: true,
  });

  const result = evaluateVoiceWorkflowRecheckExecution(input);

  if (result.decision !== "allow_recheck") {
    throw new Error(`Expected allow_recheck when no last check and signals present, got ${result.decision}`);
  }
  if (result.allowed !== true) {
    throw new Error("Expected allowed to be true");
  }

  console.log("✅ testAllowsWhenNoLastCheckAndNewSignalsPresent passed");
}

// ============================================================================
// TEST 14 — reasons_and_warnings_are_deduplicated_and_sorted
// ============================================================================

function testReasonsAndWarningsAreDeduplicatedAndSorted() {
  const scheduling = makeScheduling({
    strategy: "no_recheck",
    reasons: ["duplicate_item", "scheduling_reason"],
    warnings: ["duplicate_item", "scheduling_warning"],
  });
  const input = makeInput({ scheduling });

  const result = evaluateVoiceWorkflowRecheckExecution(input);

  // Check no duplicates
  const reasonsSet = new Set(result.reasons);
  if (result.reasons.length !== reasonsSet.size) {
    throw new Error(`Reasons should have no duplicates, got ${result.reasons.length} with ${reasonsSet.size} unique`);
  }

  const warningsSet = new Set(result.warnings);
  if (result.warnings.length !== warningsSet.size) {
    throw new Error(`Warnings should have no duplicates, got ${result.warnings.length} with ${warningsSet.size} unique`);
  }

  // Check sorted
  const sortedReasons = [...result.reasons].sort();
  if (JSON.stringify(result.reasons) !== JSON.stringify(sortedReasons)) {
    throw new Error("Reasons should be sorted");
  }

  const sortedWarnings = [...result.warnings].sort();
  if (JSON.stringify(result.warnings) !== JSON.stringify(sortedWarnings)) {
    throw new Error("Warnings should be sorted");
  }

  console.log("✅ testReasonsAndWarningsAreDeduplicatedAndSorted passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Workflow Recheck Execution Gate Tests ===\n");

try {
  testDeniesNoRecheckStrategy();
  testDeniesWhenRecoveryStillActiveForNonImmediateStrategy();
  testHoldsWhenCooldownNotElapsed();
  testHoldsWhenNoMeaningfulNewSignals();
  testAllowsWhenDelayElapsedAndNewSignalsPresent();
  testAllowsImmediateRetryDuringRecovery();
  testSetsReasonClassCorrectly();
  testIncludesReasonsAndWarnings();
  testFormatsOutputCorrectly();
  testDoesNotMutateInput();
  testReturnsDeterministicOutput();
  testSummaryContainsMeaningfulText();
  testAllowsWhenNoLastCheckAndNewSignalsPresent();
  testReasonsAndWarningsAreDeduplicatedAndSorted();

  console.log("\n✅ All voice workflow recheck execution gate tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
