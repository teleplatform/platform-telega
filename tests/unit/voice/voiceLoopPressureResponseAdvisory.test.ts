import {
  evaluateVoiceLoopPressureResponse,
  formatVoiceLoopPressureResponseAdvisory,
  type VoiceLoopPressureResponseAdvisory,
} from "../../../src/telegram/voiceLoopPressureResponseAdvisory.js";
import type { VoiceRecheckLoopStabilityAdvisory } from "../../../src/telegram/voiceRecheckLoopStabilityAdvisory.js";

// ============================================================================
// helpers
// ============================================================================

function makeStability(
  overrides: Partial<VoiceRecheckLoopStabilityAdvisory>,
): VoiceRecheckLoopStabilityAdvisory {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    stabilityStatus: overrides.stabilityStatus ?? "stable",
    confidence: overrides.confidence ?? "medium",
    loopPressure: overrides.loopPressure ?? "low",
    summary: overrides.summary ?? "Voice loop is stable.",
    advisoryInstruction: overrides.advisoryInstruction ?? "Safe to continue.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

// ============================================================================
// TEST 1 — maps_unstable_to_freeze_loop
// ============================================================================

function testMapsUnstableToFreezeLoop() {
  const stability = makeStability({ stabilityStatus: "unstable" });

  const response = evaluateVoiceLoopPressureResponse(stability);

  if (response.response !== "freeze_loop") {
    throw new Error(`Expected freeze_loop, got ${response.response}`);
  }
  if (response.recommendedAction !== "temporarily_stop_recheck") {
    throw new Error(`Expected temporarily_stop_recheck, got ${response.recommendedAction}`);
  }
  if (response.severity !== "high") {
    throw new Error(`Expected high severity, got ${response.severity}`);
  }

  console.log("✅ testMapsUnstableToFreezeLoop passed");
}

// ============================================================================
// TEST 2 — maps_watch_to_slow_down_loop
// ============================================================================

function testMapsWatchToSlowDownLoop() {
  const stability = makeStability({ stabilityStatus: "watch" });

  const response = evaluateVoiceLoopPressureResponse(stability);

  if (response.response !== "slow_down_loop") {
    throw new Error(`Expected slow_down_loop, got ${response.response}`);
  }
  if (response.recommendedAction !== "increase_delay") {
    throw new Error(`Expected increase_delay, got ${response.recommendedAction}`);
  }
  if (response.severity !== "medium") {
    throw new Error(`Expected medium severity, got ${response.severity}`);
  }

  console.log("✅ testMapsWatchToSlowDownLoop passed");
}

// ============================================================================
// TEST 3 — maps_low_confidence_stable_to_investigate_loop
// ============================================================================

function testMapsLowConfidenceStableToInvestigateLoop() {
  const stability = makeStability({
    stabilityStatus: "stable",
    confidence: "low",
  });

  const response = evaluateVoiceLoopPressureResponse(stability);

  if (response.response !== "investigate_loop") {
    throw new Error(`Expected investigate_loop, got ${response.response}`);
  }
  if (response.recommendedAction !== "manual_investigation_required") {
    throw new Error(`Expected manual_investigation_required, got ${response.recommendedAction}`);
  }
  if (response.severity !== "medium") {
    throw new Error(`Expected medium severity, got ${response.severity}`);
  }

  console.log("✅ testMapsLowConfidenceStableToInvestigateLoop passed");
}

// ============================================================================
// TEST 4 — maps_confident_stable_to_no_action
// ============================================================================

function testMapsConfidentStableToNoAction() {
  const stability = makeStability({
    stabilityStatus: "stable",
    confidence: "medium",
  });

  const response = evaluateVoiceLoopPressureResponse(stability);

  if (response.response !== "no_action") {
    throw new Error(`Expected no_action, got ${response.response}`);
  }
  if (response.recommendedAction !== "keep_current_strategy") {
    throw new Error(`Expected keep_current_strategy, got ${response.recommendedAction}`);
  }
  if (response.severity !== "low") {
    throw new Error(`Expected low severity, got ${response.severity}`);
  }

  console.log("✅ testMapsConfidentStableToNoAction passed");
}

// ============================================================================
// TEST 5 — sets_severity_correctly
// ============================================================================

function testSetsSeverityCorrectly() {
  const unstableStability = makeStability({ stabilityStatus: "unstable" });
  const watchStability = makeStability({ stabilityStatus: "watch" });
  const lowConfStability = makeStability({ stabilityStatus: "stable", confidence: "low" });
  const stableStability = makeStability({ stabilityStatus: "stable", confidence: "medium" });

  const unstableResponse = evaluateVoiceLoopPressureResponse(unstableStability);
  const watchResponse = evaluateVoiceLoopPressureResponse(watchStability);
  const lowConfResponse = evaluateVoiceLoopPressureResponse(lowConfStability);
  const stableResponse = evaluateVoiceLoopPressureResponse(stableStability);

  if (unstableResponse.severity !== "high") {
    throw new Error(`Expected high for unstable, got ${unstableResponse.severity}`);
  }
  if (watchResponse.severity !== "medium") {
    throw new Error(`Expected medium for watch, got ${watchResponse.severity}`);
  }
  if (lowConfResponse.severity !== "medium") {
    throw new Error(`Expected medium for investigate, got ${lowConfResponse.severity}`);
  }
  if (stableResponse.severity !== "low") {
    throw new Error(`Expected low for no_action, got ${stableResponse.severity}`);
  }

  console.log("✅ testSetsSeverityCorrectly passed");
}

// ============================================================================
// TEST 6 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const unstableStability = makeStability({
    stabilityStatus: "unstable",
    reasons: ["stability_reason_a"],
    warnings: ["stability_warning_a"],
  });
  const unstableResponse = evaluateVoiceLoopPressureResponse(unstableStability);

  if (unstableResponse.reasons.length === 0) {
    throw new Error("Unstable response should include reasons");
  }
  if (unstableResponse.warnings.length === 0) {
    throw new Error("Unstable response should include warnings");
  }
  if (!unstableResponse.reasons.includes("stability_reason_a")) {
    throw new Error("Response should propagate stability reasons");
  }
  if (!unstableResponse.warnings.includes("stability_warning_a")) {
    throw new Error("Response should propagate stability warnings");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 7 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const stability = makeStability({ stabilityStatus: "unstable" });
  const response = evaluateVoiceLoopPressureResponse(stability);
  const formatted = formatVoiceLoopPressureResponseAdvisory(response);

  if (!formatted.includes("🧯 Voice Loop Pressure Response")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("response:")) {
    throw new Error("Missing response in formatted output");
  }
  if (!formatted.includes("recommended action:")) {
    throw new Error("Missing recommended action in formatted output");
  }
  if (!formatted.includes("severity:")) {
    throw new Error("Missing severity in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("response instruction:")) {
    throw new Error("Missing response instruction in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 8 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const stability = makeStability({
    stabilityStatus: "watch",
    reasons: ["reason_a"],
    warnings: ["warning_a"],
  });

  const r1 = evaluateVoiceLoopPressureResponse(stability);
  const r2 = evaluateVoiceLoopPressureResponse(stability);

  // Strip generatedAtMs for comparison
  const a1 = { ...r1, generatedAtMs: 0 };
  const a2 = { ...r2, generatedAtMs: 0 };

  if (JSON.stringify(a1) !== JSON.stringify(a2)) {
    throw new Error("Response should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 9 — does_not_mutate_input
// ============================================================================

function testDoesNotMutateInput() {
  const stability = makeStability({
    stabilityStatus: "unstable",
    reasons: ["stability_reason"],
    warnings: ["stability_warning"],
  });

  const originalStability = JSON.stringify(stability);

  evaluateVoiceLoopPressureResponse(stability);

  if (JSON.stringify(stability) !== originalStability) {
    throw new Error("Input stability should not be mutated");
  }

  console.log("✅ testDoesNotMutateInput passed");
}

// ============================================================================
// TEST 10 — summary_contains_meaningful_text
// ============================================================================

function testSummaryContainsMeaningfulText() {
  const unstableStability = makeStability({ stabilityStatus: "unstable" });
  const unstableResponse = evaluateVoiceLoopPressureResponse(unstableStability);

  const stableStability = makeStability({ stabilityStatus: "stable", confidence: "medium" });
  const stableResponse = evaluateVoiceLoopPressureResponse(stableStability);

  if (unstableResponse.summary.length < 20) {
    throw new Error("Unstable summary should be meaningful");
  }
  if (unstableResponse.responseInstruction.length < 20) {
    throw new Error("Unstable response instruction should be meaningful");
  }
  if (stableResponse.summary.length < 20) {
    throw new Error("Stable summary should be meaningful");
  }
  if (stableResponse.responseInstruction.length < 20) {
    throw new Error("Stable response instruction should be meaningful");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// TEST 11 — uses_stability_warnings_in_response
// ============================================================================

function testUsesStabilityWarningsInResponse() {
  const stability = makeStability({
    stabilityStatus: "watch",
    warnings: ["stability_warning_a", "stability_warning_b"],
  });

  const response = evaluateVoiceLoopPressureResponse(stability);

  if (!response.warnings.includes("stability_warning_a")) {
    throw new Error("Response should include stability warnings");
  }
  if (!response.warnings.includes("stability_warning_b")) {
    throw new Error("Response should include stability warnings");
  }

  console.log("✅ testUsesStabilityWarningsInResponse passed");
}

// ============================================================================
// TEST 12 — deduplicates_and_sorts_reasons_and_warnings
// ============================================================================

function testDeduplicatesAndSortsReasonsAndWarnings() {
  const stability = makeStability({
    stabilityStatus: "unstable",
    reasons: ["duplicate_item", "stability_reason"],
    warnings: ["duplicate_item", "stability_warning"],
  });

  const response = evaluateVoiceLoopPressureResponse(stability);

  const reasonsSet = new Set(response.reasons);
  if (response.reasons.length !== reasonsSet.size) {
    throw new Error(`Reasons should have no duplicates, got ${response.reasons.length} with ${reasonsSet.size} unique`);
  }

  const warningsSet = new Set(response.warnings);
  if (response.warnings.length !== warningsSet.size) {
    throw new Error(`Warnings should have no duplicates, got ${response.warnings.length} with ${warningsSet.size} unique`);
  }

  const sortedReasons = [...response.reasons].sort();
  if (JSON.stringify(response.reasons) !== JSON.stringify(sortedReasons)) {
    throw new Error("Reasons should be sorted");
  }

  const sortedWarnings = [...response.warnings].sort();
  if (JSON.stringify(response.warnings) !== JSON.stringify(sortedWarnings)) {
    throw new Error("Warnings should be sorted");
  }

  console.log("✅ testDeduplicatesAndSortsReasonsAndWarnings passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Loop Pressure Response Advisory Tests ===\n");

try {
  testMapsUnstableToFreezeLoop();
  testMapsWatchToSlowDownLoop();
  testMapsLowConfidenceStableToInvestigateLoop();
  testMapsConfidentStableToNoAction();
  testSetsSeverityCorrectly();
  testIncludesReasonsAndWarnings();
  testFormatsOutputCorrectly();
  testReturnsDeterministicOutput();
  testDoesNotMutateInput();
  testSummaryContainsMeaningfulText();
  testUsesStabilityWarningsInResponse();
  testDeduplicatesAndSortsReasonsAndWarnings();

  console.log("\n✅ All voice loop pressure response advisory tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
