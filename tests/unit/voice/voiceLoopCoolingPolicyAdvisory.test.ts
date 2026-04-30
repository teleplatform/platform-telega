import {
  evaluateVoiceLoopCoolingPolicy,
  formatVoiceLoopCoolingPolicyAdvisory,
  type VoiceLoopCoolingPolicyAdvisory,
} from "../../../src/telegram/voiceLoopCoolingPolicyAdvisory.js";
import type { VoiceLoopPressureResponseAdvisory } from "../../../src/telegram/voiceLoopPressureResponseAdvisory.js";

// ============================================================================
// helpers
// ============================================================================

function makeResponse(
  overrides: Partial<VoiceLoopPressureResponseAdvisory>,
): VoiceLoopPressureResponseAdvisory {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    response: overrides.response ?? "no_action",
    recommendedAction: overrides.recommendedAction ?? "keep_current_strategy",
    severity: overrides.severity ?? "low",
    summary: overrides.summary ?? "Voice loop response advisory.",
    responseInstruction: overrides.responseInstruction ?? "Keep current policy.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

// ============================================================================
// TEST 1 — maps_freeze_loop_to_freeze_until_manual_review
// ============================================================================

function testMapsFreezeLoopToFreezeUntilManualReview() {
  const response = makeResponse({ response: "freeze_loop" });

  const advisory = evaluateVoiceLoopCoolingPolicy(response);

  if (advisory.coolingMode !== "freeze_until_manual_review") {
    throw new Error(`Expected freeze_until_manual_review, got ${advisory.coolingMode}`);
  }
  if (advisory.coolingWindowMs !== null) {
    throw new Error(`Expected null cooling window, got ${advisory.coolingWindowMs}`);
  }
  if (advisory.strictness !== "high") {
    throw new Error(`Expected high strictness, got ${advisory.strictness}`);
  }

  console.log("✅ testMapsFreezeLoopToFreezeUntilManualReview passed");
}

// ============================================================================
// TEST 2 — maps_slow_down_loop_to_hard_cooldown
// ============================================================================

function testMapsSlowDownLoopToHardCooldown() {
  const response = makeResponse({ response: "slow_down_loop" });

  const advisory = evaluateVoiceLoopCoolingPolicy(response);

  if (advisory.coolingMode !== "hard_cooldown") {
    throw new Error(`Expected hard_cooldown, got ${advisory.coolingMode}`);
  }
  if (advisory.coolingWindowMs !== 300_000) {
    throw new Error(`Expected 300000ms cooling window, got ${advisory.coolingWindowMs}`);
  }
  if (advisory.strictness !== "high") {
    throw new Error(`Expected high strictness, got ${advisory.strictness}`);
  }

  console.log("✅ testMapsSlowDownLoopToHardCooldown passed");
}

// ============================================================================
// TEST 3 — maps_investigate_loop_to_soft_cooldown
// ============================================================================

function testMapsInvestigateLoopToSoftCooldown() {
  const response = makeResponse({ response: "investigate_loop" });

  const advisory = evaluateVoiceLoopCoolingPolicy(response);

  if (advisory.coolingMode !== "soft_cooldown") {
    throw new Error(`Expected soft_cooldown, got ${advisory.coolingMode}`);
  }
  if (advisory.coolingWindowMs !== 120_000) {
    throw new Error(`Expected 120000ms cooling window, got ${advisory.coolingWindowMs}`);
  }
  if (advisory.strictness !== "medium") {
    throw new Error(`Expected medium strictness, got ${advisory.strictness}`);
  }

  console.log("✅ testMapsInvestigateLoopToSoftCooldown passed");
}

// ============================================================================
// TEST 4 — maps_no_action_to_no_cooling
// ============================================================================

function testMapsNoActionToNoCooling() {
  const response = makeResponse({ response: "no_action" });

  const advisory = evaluateVoiceLoopCoolingPolicy(response);

  if (advisory.coolingMode !== "no_cooling") {
    throw new Error(`Expected no_cooling, got ${advisory.coolingMode}`);
  }
  if (advisory.coolingWindowMs !== null) {
    throw new Error(`Expected null cooling window, got ${advisory.coolingWindowMs}`);
  }
  if (advisory.strictness !== "low") {
    throw new Error(`Expected low strictness, got ${advisory.strictness}`);
  }

  console.log("✅ testMapsNoActionToNoCooling passed");
}

// ============================================================================
// TEST 5 — sets_strictness_correctly
// ============================================================================

function testSetsStrictnessCorrectly() {
  const freezeResponse = makeResponse({ response: "freeze_loop" });
  const slowDownResponse = makeResponse({ response: "slow_down_loop" });
  const investigateResponse = makeResponse({ response: "investigate_loop" });
  const noActionResponse = makeResponse({ response: "no_action" });

  const freezeAdvisory = evaluateVoiceLoopCoolingPolicy(freezeResponse);
  const slowDownAdvisory = evaluateVoiceLoopCoolingPolicy(slowDownResponse);
  const investigateAdvisory = evaluateVoiceLoopCoolingPolicy(investigateResponse);
  const noActionAdvisory = evaluateVoiceLoopCoolingPolicy(noActionResponse);

  if (freezeAdvisory.strictness !== "high") {
    throw new Error(`Expected high for freeze, got ${freezeAdvisory.strictness}`);
  }
  if (slowDownAdvisory.strictness !== "high") {
    throw new Error(`Expected high for hard cooldown, got ${slowDownAdvisory.strictness}`);
  }
  if (investigateAdvisory.strictness !== "medium") {
    throw new Error(`Expected medium for soft cooldown, got ${investigateAdvisory.strictness}`);
  }
  if (noActionAdvisory.strictness !== "low") {
    throw new Error(`Expected low for no cooling, got ${noActionAdvisory.strictness}`);
  }

  console.log("✅ testSetsStrictnessCorrectly passed");
}

// ============================================================================
// TEST 6 — sets_cooling_window_correctly
// ============================================================================

function testSetsCoolingWindowCorrectly() {
  const freezeResponse = makeResponse({ response: "freeze_loop" });
  const slowDownResponse = makeResponse({ response: "slow_down_loop" });
  const investigateResponse = makeResponse({ response: "investigate_loop" });
  const noActionResponse = makeResponse({ response: "no_action" });

  const freezeAdvisory = evaluateVoiceLoopCoolingPolicy(freezeResponse);
  const slowDownAdvisory = evaluateVoiceLoopCoolingPolicy(slowDownResponse);
  const investigateAdvisory = evaluateVoiceLoopCoolingPolicy(investigateResponse);
  const noActionAdvisory = evaluateVoiceLoopCoolingPolicy(noActionResponse);

  if (freezeAdvisory.coolingWindowMs !== null) {
    throw new Error(`Expected null for freeze, got ${freezeAdvisory.coolingWindowMs}`);
  }
  if (slowDownAdvisory.coolingWindowMs !== 300_000) {
    throw new Error(`Expected 300000 for hard cooldown, got ${slowDownAdvisory.coolingWindowMs}`);
  }
  if (investigateAdvisory.coolingWindowMs !== 120_000) {
    throw new Error(`Expected 120000 for soft cooldown, got ${investigateAdvisory.coolingWindowMs}`);
  }
  if (noActionAdvisory.coolingWindowMs !== null) {
    throw new Error(`Expected null for no cooling, got ${noActionAdvisory.coolingWindowMs}`);
  }

  console.log("✅ testSetsCoolingWindowCorrectly passed");
}

// ============================================================================
// TEST 7 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const freezeResponse = makeResponse({
    response: "freeze_loop",
    reasons: ["response_reason_a"],
    warnings: ["response_warning_a"],
  });
  const freezeAdvisory = evaluateVoiceLoopCoolingPolicy(freezeResponse);

  if (freezeAdvisory.reasons.length === 0) {
    throw new Error("Freeze advisory should include reasons");
  }
  if (freezeAdvisory.warnings.length === 0) {
    throw new Error("Freeze advisory should include warnings");
  }
  if (!freezeAdvisory.reasons.includes("response_reason_a")) {
    throw new Error("Advisory should propagate response reasons");
  }
  if (!freezeAdvisory.warnings.includes("response_warning_a")) {
    throw new Error("Advisory should propagate response warnings");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 8 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const response = makeResponse({ response: "freeze_loop" });
  const advisory = evaluateVoiceLoopCoolingPolicy(response);
  const formatted = formatVoiceLoopCoolingPolicyAdvisory(advisory);

  if (!formatted.includes("❄️ Voice Loop Cooling Policy")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("cooling mode:")) {
    throw new Error("Missing cooling mode in formatted output");
  }
  if (!formatted.includes("cooling window ms:")) {
    throw new Error("Missing cooling window in formatted output");
  }
  if (!formatted.includes("strictness:")) {
    throw new Error("Missing strictness in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("cooling instruction:")) {
    throw new Error("Missing cooling instruction in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 9 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const response = makeResponse({
    response: "slow_down_loop",
    reasons: ["reason_a"],
    warnings: ["warning_a"],
  });

  const a1 = evaluateVoiceLoopCoolingPolicy(response);
  const a2 = evaluateVoiceLoopCoolingPolicy(response);

  // Strip generatedAtMs for comparison
  const c1 = { ...a1, generatedAtMs: 0 };
  const c2 = { ...a2, generatedAtMs: 0 };

  if (JSON.stringify(c1) !== JSON.stringify(c2)) {
    throw new Error("Cooling advisory should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_input
// ============================================================================

function testDoesNotMutateInput() {
  const response = makeResponse({
    response: "freeze_loop",
    reasons: ["response_reason"],
    warnings: ["response_warning"],
  });

  const originalResponse = JSON.stringify(response);

  evaluateVoiceLoopCoolingPolicy(response);

  if (JSON.stringify(response) !== originalResponse) {
    throw new Error("Input response should not be mutated");
  }

  console.log("✅ testDoesNotMutateInput passed");
}

// ============================================================================
// TEST 11 — deduplicates_and_sorts_reasons_and_warnings
// ============================================================================

function testDeduplicatesAndSortsReasonsAndWarnings() {
  const response = makeResponse({
    response: "freeze_loop",
    reasons: ["duplicate_item", "response_reason"],
    warnings: ["duplicate_item", "response_warning"],
  });

  const advisory = evaluateVoiceLoopCoolingPolicy(response);

  const reasonsSet = new Set(advisory.reasons);
  if (advisory.reasons.length !== reasonsSet.size) {
    throw new Error(`Reasons should have no duplicates, got ${advisory.reasons.length} with ${reasonsSet.size} unique`);
  }

  const warningsSet = new Set(advisory.warnings);
  if (advisory.warnings.length !== warningsSet.size) {
    throw new Error(`Warnings should have no duplicates, got ${advisory.warnings.length} with ${warningsSet.size} unique`);
  }

  const sortedReasons = [...advisory.reasons].sort();
  if (JSON.stringify(advisory.reasons) !== JSON.stringify(sortedReasons)) {
    throw new Error("Reasons should be sorted");
  }

  const sortedWarnings = [...advisory.warnings].sort();
  if (JSON.stringify(advisory.warnings) !== JSON.stringify(sortedWarnings)) {
    throw new Error("Warnings should be sorted");
  }

  console.log("✅ testDeduplicatesAndSortsReasonsAndWarnings passed");
}

// ============================================================================
// TEST 12 — summary_contains_meaningful_text
// ============================================================================

function testSummaryContainsMeaningfulText() {
  const freezeResponse = makeResponse({ response: "freeze_loop" });
  const freezeAdvisory = evaluateVoiceLoopCoolingPolicy(freezeResponse);

  const noActionResponse = makeResponse({ response: "no_action" });
  const noActionAdvisory = evaluateVoiceLoopCoolingPolicy(noActionResponse);

  if (freezeAdvisory.summary.length < 20) {
    throw new Error("Freeze advisory summary should be meaningful");
  }
  if (freezeAdvisory.coolingInstruction.length < 20) {
    throw new Error("Freeze advisory cooling instruction should be meaningful");
  }
  if (noActionAdvisory.summary.length < 20) {
    throw new Error("No cooling advisory summary should be meaningful");
  }
  if (noActionAdvisory.coolingInstruction.length < 20) {
    throw new Error("No cooling advisory cooling instruction should be meaningful");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Loop Cooling Policy Advisory Tests ===\n");

try {
  testMapsFreezeLoopToFreezeUntilManualReview();
  testMapsSlowDownLoopToHardCooldown();
  testMapsInvestigateLoopToSoftCooldown();
  testMapsNoActionToNoCooling();
  testSetsStrictnessCorrectly();
  testSetsCoolingWindowCorrectly();
  testIncludesReasonsAndWarnings();
  testFormatsOutputCorrectly();
  testReturnsDeterministicOutput();
  testDoesNotMutateInput();
  testDeduplicatesAndSortsReasonsAndWarnings();
  testSummaryContainsMeaningfulText();

  console.log("\n✅ All voice loop cooling policy advisory tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
