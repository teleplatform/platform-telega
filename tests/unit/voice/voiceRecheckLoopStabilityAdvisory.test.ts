import {
  evaluateVoiceRecheckLoopStability,
  formatVoiceRecheckLoopStabilityAdvisory,
  type VoiceRecheckLoopStabilityAdvisory,
} from "../../../src/telegram/voiceRecheckLoopStabilityAdvisory.js";
import type { VoiceRecheckExecutionReadinessSummary } from "../../../src/telegram/voiceRecheckExecutionReadinessMemory.js";

// ============================================================================
// helpers
// ============================================================================

function makeSummary(
  overrides: Partial<VoiceRecheckExecutionReadinessSummary>,
): VoiceRecheckExecutionReadinessSummary {
  return {
    totalChecks: overrides.totalChecks ?? 0,
    allowCount: overrides.allowCount ?? 0,
    holdCount: overrides.holdCount ?? 0,
    denyCount: overrides.denyCount ?? 0,
    lastDecision: overrides.lastDecision ?? null,
    lastCheckAtMs: overrides.lastCheckAtMs ?? null,
    repeatedHoldPattern: overrides.repeatedHoldPattern ?? false,
    repeatedDenyPattern: overrides.repeatedDenyPattern ?? false,
  };
}

// ============================================================================
// TEST 1 — marks_repeated_deny_pattern_as_unstable
// ============================================================================

function testMarksRepeatedDenyPatternAsUnstable() {
  const summary = makeSummary({
    totalChecks: 4,
    allowCount: 1,
    holdCount: 1,
    denyCount: 2,
    repeatedDenyPattern: true,
  });

  const advisory = evaluateVoiceRecheckLoopStability(summary);

  if (advisory.stabilityStatus !== "unstable") {
    throw new Error(`Expected unstable, got ${advisory.stabilityStatus}`);
  }
  if (advisory.confidence !== "high") {
    throw new Error(`Expected high confidence, got ${advisory.confidence}`);
  }
  if (advisory.loopPressure !== "high") {
    throw new Error(`Expected high loop pressure, got ${advisory.loopPressure}`);
  }

  console.log("✅ testMarksRepeatedDenyPatternAsUnstable passed");
}

// ============================================================================
// TEST 2 — marks_repeated_hold_pattern_as_unstable
// ============================================================================

function testMarksRepeatedHoldPatternAsUnstable() {
  const summary = makeSummary({
    totalChecks: 5,
    allowCount: 1,
    holdCount: 3,
    denyCount: 1,
    repeatedHoldPattern: true,
  });

  const advisory = evaluateVoiceRecheckLoopStability(summary);

  if (advisory.stabilityStatus !== "unstable") {
    throw new Error(`Expected unstable, got ${advisory.stabilityStatus}`);
  }
  if (advisory.confidence !== "high") {
    throw new Error(`Expected high confidence, got ${advisory.confidence}`);
  }
  if (advisory.loopPressure !== "high") {
    throw new Error(`Expected high loop pressure, got ${advisory.loopPressure}`);
  }

  console.log("✅ testMarksRepeatedHoldPatternAsUnstable passed");
}

// ============================================================================
// TEST 3 — marks_zero_allow_after_many_checks_as_unstable
// ============================================================================

function testMarksZeroAllowAfterManyChecksAsUnstable() {
  const summary = makeSummary({
    totalChecks: 6,
    allowCount: 0,
    holdCount: 4,
    denyCount: 2,
    repeatedHoldPattern: false,
    repeatedDenyPattern: false,
  });

  const advisory = evaluateVoiceRecheckLoopStability(summary);

  if (advisory.stabilityStatus !== "unstable") {
    throw new Error(`Expected unstable for zero allow after many checks, got ${advisory.stabilityStatus}`);
  }
  if (advisory.confidence !== "high") {
    throw new Error(`Expected high confidence, got ${advisory.confidence}`);
  }
  if (advisory.loopPressure !== "high") {
    throw new Error(`Expected high loop pressure, got ${advisory.loopPressure}`);
  }

  console.log("✅ testMarksZeroAllowAfterManyChecksAsUnstable passed");
}

// ============================================================================
// TEST 4 — marks_mixed_loop_as_watch
// ============================================================================

function testMarksMixedLoopAsWatch() {
  const summary = makeSummary({
    totalChecks: 5,
    allowCount: 2,
    holdCount: 2,
    denyCount: 1,
    repeatedHoldPattern: false,
    repeatedDenyPattern: false,
  });

  const advisory = evaluateVoiceRecheckLoopStability(summary);

  if (advisory.stabilityStatus !== "watch") {
    throw new Error(`Expected watch, got ${advisory.stabilityStatus}`);
  }
  if (advisory.confidence !== "medium") {
    throw new Error(`Expected medium confidence, got ${advisory.confidence}`);
  }
  if (advisory.loopPressure !== "medium") {
    throw new Error(`Expected medium loop pressure, got ${advisory.loopPressure}`);
  }

  console.log("✅ testMarksMixedLoopAsWatch passed");
}

// ============================================================================
// TEST 5 — marks_clean_loop_as_stable
// ============================================================================

function testMarksCleanLoopAsStable() {
  const summary = makeSummary({
    totalChecks: 3,
    allowCount: 3,
    holdCount: 0,
    denyCount: 0,
    repeatedHoldPattern: false,
    repeatedDenyPattern: false,
  });

  const advisory = evaluateVoiceRecheckLoopStability(summary);

  if (advisory.stabilityStatus !== "stable") {
    throw new Error(`Expected stable, got ${advisory.stabilityStatus}`);
  }
  if (advisory.confidence !== "medium") {
    throw new Error(`Expected medium confidence, got ${advisory.confidence}`);
  }
  if (advisory.loopPressure !== "low") {
    throw new Error(`Expected low loop pressure, got ${advisory.loopPressure}`);
  }

  console.log("✅ testMarksCleanLoopAsStable passed");
}

// ============================================================================
// TEST 6 — marks_empty_history_as_low_confidence_stable
// ============================================================================

function testMarksEmptyHistoryAsLowConfidenceStable() {
  const summary = makeSummary({
    totalChecks: 0,
    allowCount: 0,
    holdCount: 0,
    denyCount: 0,
    lastDecision: null,
    lastCheckAtMs: null,
    repeatedHoldPattern: false,
    repeatedDenyPattern: false,
  });

  const advisory = evaluateVoiceRecheckLoopStability(summary);

  if (advisory.stabilityStatus !== "stable") {
    throw new Error(`Expected stable for empty history, got ${advisory.stabilityStatus}`);
  }
  if (advisory.confidence !== "low") {
    throw new Error(`Expected low confidence for empty history, got ${advisory.confidence}`);
  }
  if (advisory.loopPressure !== "low") {
    throw new Error(`Expected low loop pressure, got ${advisory.loopPressure}`);
  }
  if (!advisory.warnings.includes("loop_history_not_yet_available")) {
    throw new Error("Expected loop_history_not_yet_available warning");
  }

  console.log("✅ testMarksEmptyHistoryAsLowConfidenceStable passed");
}

// ============================================================================
// TEST 7 — sets_loop_pressure_correctly
// ============================================================================

function testSetsLoopPressureCorrectly() {
  const unstableSummary = makeSummary({
    totalChecks: 2,
    allowCount: 0,
    holdCount: 0,
    denyCount: 2,
    repeatedDenyPattern: true,
  });
  const watchSummary = makeSummary({
    totalChecks: 5,
    allowCount: 2,
    holdCount: 2,
    denyCount: 1,
  });
  const stableSummary = makeSummary({
    totalChecks: 2,
    allowCount: 2,
    holdCount: 0,
    denyCount: 0,
  });

  const unstableAdvisory = evaluateVoiceRecheckLoopStability(unstableSummary);
  const watchAdvisory = evaluateVoiceRecheckLoopStability(watchSummary);
  const stableAdvisory = evaluateVoiceRecheckLoopStability(stableSummary);

  if (unstableAdvisory.loopPressure !== "high") {
    throw new Error(`Expected high for unstable, got ${unstableAdvisory.loopPressure}`);
  }
  if (watchAdvisory.loopPressure !== "medium") {
    throw new Error(`Expected medium for watch, got ${watchAdvisory.loopPressure}`);
  }
  if (stableAdvisory.loopPressure !== "low") {
    throw new Error(`Expected low for stable, got ${stableAdvisory.loopPressure}`);
  }

  console.log("✅ testSetsLoopPressureCorrectly passed");
}

// ============================================================================
// TEST 8 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const summary = makeSummary({ repeatedDenyPattern: true });
  const advisory = evaluateVoiceRecheckLoopStability(summary);
  const formatted = formatVoiceRecheckLoopStabilityAdvisory(advisory);

  if (!formatted.includes("🌀 Voice Recheck Loop Stability")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("stability status:")) {
    throw new Error("Missing stability status in formatted output");
  }
  if (!formatted.includes("confidence:")) {
    throw new Error("Missing confidence in formatted output");
  }
  if (!formatted.includes("loop pressure:")) {
    throw new Error("Missing loop pressure in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("advisory instruction:")) {
    throw new Error("Missing advisory instruction in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 9 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const summary = makeSummary({
    totalChecks: 5,
    allowCount: 2,
    holdCount: 2,
    denyCount: 1,
  });

  const advisory1 = evaluateVoiceRecheckLoopStability(summary);
  const advisory2 = evaluateVoiceRecheckLoopStability(summary);

  // Strip generatedAtMs for comparison
  const a1 = { ...advisory1, generatedAtMs: 0 };
  const a2 = { ...advisory2, generatedAtMs: 0 };

  if (JSON.stringify(a1) !== JSON.stringify(a2)) {
    throw new Error("Advisory should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_input
// ============================================================================

function testDoesNotMutateInput() {
  const summary = makeSummary({
    totalChecks: 4,
    allowCount: 1,
    holdCount: 2,
    denyCount: 1,
    repeatedHoldPattern: true,
  });

  const originalSummary = JSON.stringify(summary);

  evaluateVoiceRecheckLoopStability(summary);

  if (JSON.stringify(summary) !== originalSummary) {
    throw new Error("Input summary should not be mutated");
  }

  console.log("✅ testDoesNotMutateInput passed");
}

// ============================================================================
// TEST 11 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const unstableSummary = makeSummary({
    totalChecks: 2,
    allowCount: 0,
    denyCount: 2,
    repeatedDenyPattern: true,
  });
  const unstableAdvisory = evaluateVoiceRecheckLoopStability(unstableSummary);

  const watchSummary = makeSummary({
    totalChecks: 5,
    allowCount: 2,
    holdCount: 2,
    denyCount: 1,
  });
  const watchAdvisory = evaluateVoiceRecheckLoopStability(watchSummary);

  const stableSummary = makeSummary({
    totalChecks: 2,
    allowCount: 2,
    holdCount: 0,
    denyCount: 0,
  });
  const stableAdvisory = evaluateVoiceRecheckLoopStability(stableSummary);

  // Unstable should have reasons and warnings
  if (unstableAdvisory.reasons.length === 0) {
    throw new Error("Unstable advisory should include reasons");
  }
  if (unstableAdvisory.warnings.length === 0) {
    throw new Error("Unstable advisory should include warnings");
  }

  // Watch should have reasons and warnings
  if (watchAdvisory.reasons.length === 0) {
    throw new Error("Watch advisory should include reasons");
  }
  if (watchAdvisory.warnings.length === 0) {
    throw new Error("Watch advisory should include warnings");
  }

  // Stable should have reasons
  if (stableAdvisory.reasons.length === 0) {
    throw new Error("Stable advisory should include reasons");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 12 — summary_contains_meaningful_text
// ============================================================================

function testSummaryContainsMeaningfulText() {
  const unstableSummary = makeSummary({ repeatedDenyPattern: true });
  const unstableAdvisory = evaluateVoiceRecheckLoopStability(unstableSummary);

  const stableSummary = makeSummary({
    totalChecks: 2,
    allowCount: 2,
  });
  const stableAdvisory = evaluateVoiceRecheckLoopStability(stableSummary);

  if (unstableAdvisory.summary.length < 20) {
    throw new Error("Unstable summary should be meaningful");
  }
  if (unstableAdvisory.advisoryInstruction.length < 20) {
    throw new Error("Unstable advisory instruction should be meaningful");
  }
  if (stableAdvisory.summary.length < 20) {
    throw new Error("Stable summary should be meaningful");
  }
  if (stableAdvisory.advisoryInstruction.length < 20) {
    throw new Error("Stable advisory instruction should be meaningful");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Recheck Loop Stability Advisory Tests ===\n");

try {
  testMarksRepeatedDenyPatternAsUnstable();
  testMarksRepeatedHoldPatternAsUnstable();
  testMarksZeroAllowAfterManyChecksAsUnstable();
  testMarksMixedLoopAsWatch();
  testMarksCleanLoopAsStable();
  testMarksEmptyHistoryAsLowConfidenceStable();
  testSetsLoopPressureCorrectly();
  testFormatsOutputCorrectly();
  testReturnsDeterministicOutput();
  testDoesNotMutateInput();
  testIncludesReasonsAndWarnings();
  testSummaryContainsMeaningfulText();

  console.log("\n✅ All voice recheck loop stability advisory tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
