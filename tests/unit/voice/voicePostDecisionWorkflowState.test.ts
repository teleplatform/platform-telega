import {
  determineVoicePostDecisionWorkflowState,
  formatVoicePostDecisionWorkflowState,
  type VoicePostDecisionWorkflowState,
} from "../../../src/telegram/voicePostDecisionWorkflowState.js";
import type { VoiceHumanApprovalDecisionSurface } from "../../../src/telegram/voiceHumanApprovalDecisionSurface.js";

// ============================================================================
// helpers
// ============================================================================

function makeSurface(
  overrides: Partial<VoiceHumanApprovalDecisionSurface>,
): VoiceHumanApprovalDecisionSurface {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    decision: overrides.decision ?? "approval_open",
    approvalEligible: overrides.approvalEligible ?? true,
    actionMode: overrides.actionMode ?? "approve_if_needed",
    summary: overrides.summary ?? "Voice case is sufficiently stable.",
    operatorInstruction: overrides.operatorInstruction ?? "Safe to present for approval.",
    evidenceSufficiency: overrides.evidenceSufficiency ?? "high",
    route: overrides.route ?? "passive_archive",
    priority: overrides.priority ?? "p3_low",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

// ============================================================================
// TEST 1 — maps_approval_open_to_awaiting_human_approval
// ============================================================================

function testMapsApprovalOpenToAwaitingHumanApproval() {
  const surface = makeSurface({ decision: "approval_open" });

  const state = determineVoicePostDecisionWorkflowState(surface);

  if (state.workflowState !== "awaiting_human_approval") {
    throw new Error(`Expected awaiting_human_approval, got ${state.workflowState}`);
  }
  if (state.nextCheckRecommended !== true) {
    throw new Error("Expected nextCheckRecommended to be true");
  }
  if (state.nextCheckMode !== "await_human_action") {
    throw new Error(`Expected await_human_action, got ${state.nextCheckMode}`);
  }
  if (state.terminal !== false) {
    throw new Error("Expected terminal to be false");
  }

  console.log("✅ testMapsApprovalOpenToAwaitingHumanApproval passed");
}

// ============================================================================
// TEST 2 — maps_approval_deferred_to_observation_hold
// ============================================================================

function testMapsApprovalDeferredToObservationHold() {
  const surface = makeSurface({
    decision: "approval_deferred",
    actionMode: "observe_only",
    route: "observation_only",
    priority: "p2_normal",
  });

  const state = determineVoicePostDecisionWorkflowState(surface);

  if (state.workflowState !== "observation_hold") {
    throw new Error(`Expected observation_hold, got ${state.workflowState}`);
  }
  if (state.nextCheckRecommended !== true) {
    throw new Error("Expected nextCheckRecommended to be true");
  }
  if (state.nextCheckMode !== "observe_again") {
    throw new Error(`Expected observe_again, got ${state.nextCheckMode}`);
  }
  if (state.terminal !== false) {
    throw new Error("Expected terminal to be false");
  }

  console.log("✅ testMapsApprovalDeferredToObservationHold passed");
}

// ============================================================================
// TEST 3 — maps_approval_blocked_to_risk_block_recovery
// ============================================================================

function testMapsApprovalBlockedToRiskBlockRecovery() {
  const surface = makeSurface({
    decision: "approval_blocked",
    approvalEligible: false,
    actionMode: "block_approval",
    route: "immediate_human_review",
    priority: "p0_immediate",
  });

  const state = determineVoicePostDecisionWorkflowState(surface);

  if (state.workflowState !== "risk_block_recovery") {
    throw new Error(`Expected risk_block_recovery, got ${state.workflowState}`);
  }
  if (state.nextCheckRecommended !== true) {
    throw new Error("Expected nextCheckRecommended to be true");
  }
  if (state.nextCheckMode !== "recover_then_recheck") {
    throw new Error(`Expected recover_then_recheck, got ${state.nextCheckMode}`);
  }
  if (state.terminal !== false) {
    throw new Error("Expected terminal to be false");
  }

  console.log("✅ testMapsApprovalBlockedToRiskBlockRecovery passed");
}

// ============================================================================
// TEST 4 — uses_passive_monitoring_fallback_for_unknown_state
// ============================================================================

function testUsesPassiveMonitoringFallbackForUnknownState() {
  const surface = makeSurface({
    decision: "unknown_decision" as any,
    route: "unknown_route",
    priority: "unknown_priority",
  });

  const state = determineVoicePostDecisionWorkflowState(surface);

  if (state.workflowState !== "passive_monitoring") {
    throw new Error(`Expected passive_monitoring, got ${state.workflowState}`);
  }
  if (state.nextCheckRecommended !== false) {
    throw new Error("Expected nextCheckRecommended to be false");
  }
  if (state.nextCheckMode !== "none") {
    throw new Error(`Expected none, got ${state.nextCheckMode}`);
  }
  if (state.terminal !== false) {
    throw new Error("Expected terminal to be false");
  }
  if (!state.warnings.includes("workflow_fallback_state_used")) {
    throw new Error("Expected workflow_fallback_state_used warning");
  }

  console.log("✅ testUsesPassiveMonitoringFallbackForUnknownState passed");
}

// ============================================================================
// TEST 5 — sets_next_check_mode_correctly
// ============================================================================

function testSetsNextCheckModeCorrectly() {
  const openSurface = makeSurface({ decision: "approval_open" });
  const deferredSurface = makeSurface({ decision: "approval_deferred" });
  const blockedSurface = makeSurface({ decision: "approval_blocked" });

  const openState = determineVoicePostDecisionWorkflowState(openSurface);
  const deferredState = determineVoicePostDecisionWorkflowState(deferredSurface);
  const blockedState = determineVoicePostDecisionWorkflowState(blockedSurface);

  if (openState.nextCheckMode !== "await_human_action") {
    throw new Error(`Expected await_human_action for open, got ${openState.nextCheckMode}`);
  }
  if (deferredState.nextCheckMode !== "observe_again") {
    throw new Error(`Expected observe_again for deferred, got ${deferredState.nextCheckMode}`);
  }
  if (blockedState.nextCheckMode !== "recover_then_recheck") {
    throw new Error(`Expected recover_then_recheck for blocked, got ${blockedState.nextCheckMode}`);
  }

  console.log("✅ testSetsNextCheckModeCorrectly passed");
}

// ============================================================================
// TEST 6 — sets_terminal_flag_correctly
// ============================================================================

function testSetsTerminalFlagCorrectly() {
  const openSurface = makeSurface({ decision: "approval_open" });
  const deferredSurface = makeSurface({ decision: "approval_deferred" });
  const blockedSurface = makeSurface({ decision: "approval_blocked" });

  const openState = determineVoicePostDecisionWorkflowState(openSurface);
  const deferredState = determineVoicePostDecisionWorkflowState(deferredSurface);
  const blockedState = determineVoicePostDecisionWorkflowState(blockedSurface);

  if (openState.terminal !== false) {
    throw new Error("Open state should not be terminal");
  }
  if (deferredState.terminal !== false) {
    throw new Error("Deferred state should not be terminal");
  }
  if (blockedState.terminal !== false) {
    throw new Error("Blocked state should not be terminal");
  }

  console.log("✅ testSetsTerminalFlagCorrectly passed");
}

// ============================================================================
// TEST 7 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const openSurface = makeSurface({
    decision: "approval_open",
    reasons: ["surface_reason_a"],
    warnings: ["surface_warning_a"],
  });
  const blockedSurface = makeSurface({
    decision: "approval_blocked",
    reasons: ["surface_reason_b"],
    warnings: ["surface_warning_b"],
  });

  const openState = determineVoicePostDecisionWorkflowState(openSurface);
  const blockedState = determineVoicePostDecisionWorkflowState(blockedSurface);

  // Open should have reasons
  if (openState.reasons.length === 0) {
    throw new Error("Open workflow state should include reasons");
  }
  if (!openState.reasons.includes("surface_reason_a")) {
    throw new Error("Open workflow state should propagate surface reasons");
  }

  // Blocked should have reasons and warnings
  if (blockedState.reasons.length === 0) {
    throw new Error("Blocked workflow state should include reasons");
  }
  if (blockedState.warnings.length === 0) {
    throw new Error("Blocked workflow state should include warnings");
  }
  if (!blockedState.warnings.includes("workflow_progression_blocked_until_recovery")) {
    throw new Error("Blocked workflow should include workflow-specific warning");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 8 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const surface = makeSurface({ decision: "approval_open" });
  const state = determineVoicePostDecisionWorkflowState(surface);
  const formatted = formatVoicePostDecisionWorkflowState(state);

  if (!formatted.includes("🧭 Voice Workflow State")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("workflow state:")) {
    throw new Error("Missing workflow state in formatted output");
  }
  if (!formatted.includes("terminal:")) {
    throw new Error("Missing terminal in formatted output");
  }
  if (!formatted.includes("next check recommended:")) {
    throw new Error("Missing next check recommended in formatted output");
  }
  if (!formatted.includes("next check mode:")) {
    throw new Error("Missing next check mode in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("workflow instruction:")) {
    throw new Error("Missing workflow instruction in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 9 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const surface = makeSurface({
    decision: "approval_deferred",
    reasons: ["reason_a", "reason_b"],
    warnings: ["warning_a"],
  });

  const state1 = determineVoicePostDecisionWorkflowState(surface);
  const state2 = determineVoicePostDecisionWorkflowState(surface);

  // Strip generatedAtMs for comparison
  const s1 = { ...state1, generatedAtMs: 0 };
  const s2 = { ...state2, generatedAtMs: 0 };

  if (JSON.stringify(s1) !== JSON.stringify(s2)) {
    throw new Error("Workflow state should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_input_surface
// ============================================================================

function testDoesNotMutateInputSurface() {
  const surface = makeSurface({
    decision: "approval_blocked",
    reasons: ["surface_reason"],
    warnings: ["surface_warning"],
  });

  const originalSurface = JSON.stringify(surface);

  determineVoicePostDecisionWorkflowState(surface);

  if (JSON.stringify(surface) !== originalSurface) {
    throw new Error("Input surface should not be mutated");
  }

  console.log("✅ testDoesNotMutateInputSurface passed");
}

// ============================================================================
// TEST 11 — summary_contains_meaningful_text
// ============================================================================

function testSummaryContainsMeaningfulText() {
  const openSurface = makeSurface({ decision: "approval_open" });
  const blockedSurface = makeSurface({ decision: "approval_blocked" });

  const openState = determineVoicePostDecisionWorkflowState(openSurface);
  const blockedState = determineVoicePostDecisionWorkflowState(blockedSurface);

  if (openState.summary.length < 20) {
    throw new Error("Open state summary should be meaningful and descriptive");
  }
  if (openState.workflowInstruction.length < 20) {
    throw new Error("Open state workflow instruction should be meaningful");
  }
  if (blockedState.summary.length < 20) {
    throw new Error("Blocked state summary should be meaningful and descriptive");
  }
  if (blockedState.workflowInstruction.length < 20) {
    throw new Error("Blocked state workflow instruction should be meaningful");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// TEST 12 — reasons_and_warnings_are_deduplicated_and_sorted
// ============================================================================

function testReasonsAndWarningsAreDeduplicatedAndSorted() {
  const surface = makeSurface({
    decision: "approval_deferred",
    reasons: ["duplicate_item", "surface_reason"],
    warnings: ["duplicate_item", "surface_warning"],
  });

  const state = determineVoicePostDecisionWorkflowState(surface);

  // Check no duplicates
  const reasonsSet = new Set(state.reasons);
  if (state.reasons.length !== reasonsSet.size) {
    throw new Error(`Reasons should have no duplicates, got ${state.reasons.length} with ${reasonsSet.size} unique`);
  }

  const warningsSet = new Set(state.warnings);
  if (state.warnings.length !== warningsSet.size) {
    throw new Error(`Warnings should have no duplicates, got ${state.warnings.length} with ${warningsSet.size} unique`);
  }

  // Check sorted
  const sortedReasons = [...state.reasons].sort();
  if (JSON.stringify(state.reasons) !== JSON.stringify(sortedReasons)) {
    throw new Error("Reasons should be sorted");
  }

  const sortedWarnings = [...state.warnings].sort();
  if (JSON.stringify(state.warnings) !== JSON.stringify(sortedWarnings)) {
    throw new Error("Warnings should be sorted");
  }

  console.log("✅ testReasonsAndWarningsAreDeduplicatedAndSorted passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Post-Decision Workflow State Tests ===\n");

try {
  testMapsApprovalOpenToAwaitingHumanApproval();
  testMapsApprovalDeferredToObservationHold();
  testMapsApprovalBlockedToRiskBlockRecovery();
  testUsesPassiveMonitoringFallbackForUnknownState();
  testSetsNextCheckModeCorrectly();
  testSetsTerminalFlagCorrectly();
  testIncludesReasonsAndWarnings();
  testFormatsOutputCorrectly();
  testReturnsDeterministicOutput();
  testDoesNotMutateInputSurface();
  testSummaryContainsMeaningfulText();
  testReasonsAndWarningsAreDeduplicatedAndSorted();

  console.log("\n✅ All voice post-decision workflow state tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
