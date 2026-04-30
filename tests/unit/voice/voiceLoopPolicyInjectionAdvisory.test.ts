import {
  evaluateVoiceLoopPolicyInjection,
  formatVoiceLoopPolicyInjectionAdvisory,
  type VoiceLoopPolicyInjectionAdvisory,
  type VoiceLoopPolicyInjectionInput,
  type VoiceLoopExternalPolicySignal,
} from "../../../src/telegram/voiceLoopPolicyInjectionAdvisory.js";
import type { VoiceLoopCoolingPolicyAdvisory } from "../../../src/telegram/voiceLoopCoolingPolicyAdvisory.js";
import type { VoiceLoopRecoveryResumeAdvisory } from "../../../src/telegram/voiceLoopRecoveryResumeAdvisory.js";

// ============================================================================
// helpers
// ============================================================================

function makeCooling(
  overrides: Partial<VoiceLoopCoolingPolicyAdvisory>,
): VoiceLoopCoolingPolicyAdvisory {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    coolingMode: overrides.coolingMode ?? "no_cooling",
    coolingWindowMs: overrides.coolingWindowMs ?? null,
    strictness: overrides.strictness ?? "low",
    summary: overrides.summary ?? "Loop cooling advisory.",
    coolingInstruction: overrides.coolingInstruction ?? "Keep current policy.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

function makeResume(
  overrides: Partial<VoiceLoopRecoveryResumeAdvisory>,
): VoiceLoopRecoveryResumeAdvisory {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    resumeDecision: overrides.resumeDecision ?? "resume_normal",
    resumeMode: overrides.resumeMode ?? "full_resume",
    readinessLevel: overrides.readinessLevel ?? "high",
    summary: overrides.summary ?? "Loop resume advisory.",
    resumeInstruction: overrides.resumeInstruction ?? "Resume at normal cadence.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

function makeInput(
  overrides: Partial<VoiceLoopPolicyInjectionInput>,
): VoiceLoopPolicyInjectionInput {
  return {
    externalSignal: overrides.externalSignal ?? "none",
    cooling: overrides.cooling ?? makeCooling({}),
    resume: overrides.resume ?? makeResume({}),
  };
}

// ============================================================================
// TEST 1 — maps_none_to_no_override
// ============================================================================

function testMapsNoneToNoOverride() {
  const input = makeInput({ externalSignal: "none" });

  const advisory = evaluateVoiceLoopPolicyInjection(input);

  if (advisory.overrideDecision !== "no_override") {
    throw new Error(`Expected no_override, got ${advisory.overrideDecision}`);
  }
  if (advisory.effectiveSignal !== "none") {
    throw new Error(`Expected effective signal none, got ${advisory.effectiveSignal}`);
  }
  if (advisory.policyDirection !== "keep_internal_policy") {
    throw new Error(`Expected keep_internal_policy, got ${advisory.policyDirection}`);
  }

  console.log("✅ testMapsNoneToNoOverride passed");
}

// ============================================================================
// TEST 2 — maps_soft_operator_signal_to_soft_override
// ============================================================================

function testMapsSoftOperatorSignalToSoftOverride() {
  const input = makeInput({ externalSignal: "operator_override_soft" });

  const advisory = evaluateVoiceLoopPolicyInjection(input);

  if (advisory.overrideDecision !== "soft_override") {
    throw new Error(`Expected soft_override, got ${advisory.overrideDecision}`);
  }
  if (advisory.policyDirection !== "bias_toward_slowdown") {
    throw new Error(`Expected bias_toward_slowdown, got ${advisory.policyDirection}`);
  }

  console.log("✅ testMapsSoftOperatorSignalToSoftOverride passed");
}

// ============================================================================
// TEST 3 — maps_experiment_slowdown_to_soft_override
// ============================================================================

function testMapsExperimentSlowdownToSoftOverride() {
  const input = makeInput({ externalSignal: "experiment_slowdown" });

  const advisory = evaluateVoiceLoopPolicyInjection(input);

  if (advisory.overrideDecision !== "soft_override") {
    throw new Error(`Expected soft_override for experiment, got ${advisory.overrideDecision}`);
  }
  if (advisory.effectiveSignal !== "experiment_slowdown") {
    throw new Error(`Expected effective signal experiment_slowdown, got ${advisory.effectiveSignal}`);
  }

  console.log("✅ testMapsExperimentSlowdownToSoftOverride passed");
}

// ============================================================================
// TEST 4 — maps_creator_force_cooling_to_hard_override
// ============================================================================

function testMapsCreatorForceCoolingToHardOverride() {
  const input = makeInput({ externalSignal: "creator_force_cooling" });

  const advisory = evaluateVoiceLoopPolicyInjection(input);

  if (advisory.overrideDecision !== "hard_override") {
    throw new Error(`Expected hard_override, got ${advisory.overrideDecision}`);
  }
  if (advisory.policyDirection !== "bias_toward_cooling") {
    throw new Error(`Expected bias_toward_cooling, got ${advisory.policyDirection}`);
  }

  console.log("✅ testMapsCreatorForceCoolingToHardOverride passed");
}

// ============================================================================
// TEST 5 — maps_creator_force_resume_hold_to_hard_override
// ============================================================================

function testMapsCreatorForceResumeHoldToHardOverride() {
  const input = makeInput({ externalSignal: "creator_force_resume_hold" });

  const advisory = evaluateVoiceLoopPolicyInjection(input);

  if (advisory.overrideDecision !== "hard_override") {
    throw new Error(`Expected hard_override, got ${advisory.overrideDecision}`);
  }
  if (advisory.policyDirection !== "bias_toward_resume_hold") {
    throw new Error(`Expected bias_toward_resume_hold, got ${advisory.policyDirection}`);
  }

  console.log("✅ testMapsCreatorForceResumeHoldToHardOverride passed");
}

// ============================================================================
// TEST 6 — maps_operator_override_hard_to_hard_override
// ============================================================================

function testMapsOperatorOverrideHardToHardOverride() {
  const input = makeInput({ externalSignal: "operator_override_hard" });

  const advisory = evaluateVoiceLoopPolicyInjection(input);

  if (advisory.overrideDecision !== "hard_override") {
    throw new Error(`Expected hard_override for hard operator, got ${advisory.overrideDecision}`);
  }
  if (advisory.policyDirection !== "bias_toward_resume_hold") {
    throw new Error(`Expected bias_toward_resume_hold, got ${advisory.policyDirection}`);
  }

  console.log("✅ testMapsOperatorOverrideHardToHardOverride passed");
}

// ============================================================================
// TEST 7 — sets_severity_correctly
// ============================================================================

function testSetsSeverityCorrectly() {
  const noneInput = makeInput({ externalSignal: "none" });
  const softInput = makeInput({ externalSignal: "operator_override_soft" });
  const experimentInput = makeInput({ externalSignal: "experiment_slowdown" });
  const creatorCoolingInput = makeInput({ externalSignal: "creator_force_cooling" });
  const creatorHoldInput = makeInput({ externalSignal: "creator_force_resume_hold" });
  const hardOpInput = makeInput({ externalSignal: "operator_override_hard" });

  const noneAdvisory = evaluateVoiceLoopPolicyInjection(noneInput);
  const softAdvisory = evaluateVoiceLoopPolicyInjection(softInput);
  const experimentAdvisory = evaluateVoiceLoopPolicyInjection(experimentInput);
  const creatorCoolingAdvisory = evaluateVoiceLoopPolicyInjection(creatorCoolingInput);
  const creatorHoldAdvisory = evaluateVoiceLoopPolicyInjection(creatorHoldInput);
  const hardOpAdvisory = evaluateVoiceLoopPolicyInjection(hardOpInput);

  if (noneAdvisory.severity !== "low") {
    throw new Error(`Expected low for none, got ${noneAdvisory.severity}`);
  }
  if (softAdvisory.severity !== "medium") {
    throw new Error(`Expected medium for soft, got ${softAdvisory.severity}`);
  }
  if (experimentAdvisory.severity !== "medium") {
    throw new Error(`Expected medium for experiment, got ${experimentAdvisory.severity}`);
  }
  if (creatorCoolingAdvisory.severity !== "high") {
    throw new Error(`Expected high for creator cooling, got ${creatorCoolingAdvisory.severity}`);
  }
  if (creatorHoldAdvisory.severity !== "high") {
    throw new Error(`Expected high for creator hold, got ${creatorHoldAdvisory.severity}`);
  }
  if (hardOpAdvisory.severity !== "high") {
    throw new Error(`Expected high for hard operator, got ${hardOpAdvisory.severity}`);
  }

  console.log("✅ testSetsSeverityCorrectly passed");
}

// ============================================================================
// TEST 8 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const input = makeInput({ externalSignal: "creator_force_cooling" });
  const advisory = evaluateVoiceLoopPolicyInjection(input);
  const formatted = formatVoiceLoopPolicyInjectionAdvisory(advisory);

  if (!formatted.includes("🧩 Voice Loop Policy Injection")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("override decision:")) {
    throw new Error("Missing override decision in formatted output");
  }
  if (!formatted.includes("effective signal:")) {
    throw new Error("Missing effective signal in formatted output");
  }
  if (!formatted.includes("policy direction:")) {
    throw new Error("Missing policy direction in formatted output");
  }
  if (!formatted.includes("severity:")) {
    throw new Error("Missing severity in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("policy instruction:")) {
    throw new Error("Missing policy instruction in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 9 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const input = makeInput({
    externalSignal: "operator_override_soft",
    cooling: makeCooling({ reasons: ["cooling_reason"] }),
    resume: makeResume({ reasons: ["resume_reason"] }),
  });

  const a1 = evaluateVoiceLoopPolicyInjection(input);
  const a2 = evaluateVoiceLoopPolicyInjection(input);

  // Strip generatedAtMs for comparison
  const p1 = { ...a1, generatedAtMs: 0 };
  const p2 = { ...a2, generatedAtMs: 0 };

  if (JSON.stringify(p1) !== JSON.stringify(p2)) {
    throw new Error("Policy injection advisory should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_input
// ============================================================================

function testDoesNotMutateInput() {
  const cooling = makeCooling({
    reasons: ["cooling_reason"],
    warnings: ["cooling_warning"],
  });
  const resume = makeResume({
    reasons: ["resume_reason"],
    warnings: ["resume_warning"],
  });
  const input: VoiceLoopPolicyInjectionInput = {
    externalSignal: "creator_force_cooling",
    cooling,
    resume,
  };

  const originalCooling = JSON.stringify(input.cooling);
  const originalResume = JSON.stringify(input.resume);

  evaluateVoiceLoopPolicyInjection(input);

  if (JSON.stringify(input.cooling) !== originalCooling) {
    throw new Error("Input cooling should not be mutated");
  }
  if (JSON.stringify(input.resume) !== originalResume) {
    throw new Error("Input resume should not be mutated");
  }

  console.log("✅ testDoesNotMutateInput passed");
}

// ============================================================================
// TEST 11 — deduplicates_and_sorts_reasons_and_warnings
// ============================================================================

function testDeduplicatesAndSortsReasonsAndWarnings() {
  const input = makeInput({ externalSignal: "creator_force_cooling" });

  const advisory = evaluateVoiceLoopPolicyInjection(input);

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
  const noneInput = makeInput({ externalSignal: "none" });
  const noneAdvisory = evaluateVoiceLoopPolicyInjection(noneInput);

  const hardInput = makeInput({ externalSignal: "creator_force_cooling" });
  const hardAdvisory = evaluateVoiceLoopPolicyInjection(hardInput);

  if (noneAdvisory.summary.length < 20) {
    throw new Error("None override summary should be meaningful");
  }
  if (noneAdvisory.policyInstruction.length < 20) {
    throw new Error("None override policy instruction should be meaningful");
  }
  if (hardAdvisory.summary.length < 20) {
    throw new Error("Hard override summary should be meaningful");
  }
  if (hardAdvisory.policyInstruction.length < 20) {
    throw new Error("Hard override policy instruction should be meaningful");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Loop Policy Injection Advisory Tests ===\n");

try {
  testMapsNoneToNoOverride();
  testMapsSoftOperatorSignalToSoftOverride();
  testMapsExperimentSlowdownToSoftOverride();
  testMapsCreatorForceCoolingToHardOverride();
  testMapsCreatorForceResumeHoldToHardOverride();
  testMapsOperatorOverrideHardToHardOverride();
  testSetsSeverityCorrectly();
  testFormatsOutputCorrectly();
  testReturnsDeterministicOutput();
  testDoesNotMutateInput();
  testDeduplicatesAndSortsReasonsAndWarnings();
  testSummaryContainsMeaningfulText();

  console.log("\n✅ All voice loop policy injection advisory tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
