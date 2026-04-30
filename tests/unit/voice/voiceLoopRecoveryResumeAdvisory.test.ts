import {
  evaluateVoiceLoopRecoveryResume,
  formatVoiceLoopRecoveryResumeAdvisory,
  type VoiceLoopRecoveryResumeAdvisory,
  type EvaluateVoiceLoopRecoveryResumeInput,
} from "../../../src/telegram/voiceLoopRecoveryResumeAdvisory.js";
import type { VoiceLoopCoolingPolicyAdvisory } from "../../../src/telegram/voiceLoopCoolingPolicyAdvisory.js";

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

function makeInput(
  overrides: Partial<EvaluateVoiceLoopRecoveryResumeInput>,
): EvaluateVoiceLoopRecoveryResumeInput {
  return {
    cooling: overrides.cooling ?? makeCooling({}),
    hasNewStabilitySignals: overrides.hasNewStabilitySignals ?? true,
  };
}

// ============================================================================
// TEST 1 — freeze → remain_in_cooling
// ============================================================================

function testFreezeRemainsInCooling() {
  const input = makeInput({
    cooling: makeCooling({ coolingMode: "freeze_until_manual_review" }),
    hasNewStabilitySignals: true,
  });

  const advisory = evaluateVoiceLoopRecoveryResume(input);

  if (advisory.resumeDecision !== "remain_in_cooling") {
    throw new Error(`Expected remain_in_cooling, got ${advisory.resumeDecision}`);
  }
  if (advisory.resumeMode !== "hold_position") {
    throw new Error(`Expected hold_position, got ${advisory.resumeMode}`);
  }
  if (advisory.readinessLevel !== "low") {
    throw new Error(`Expected low readiness, got ${advisory.readinessLevel}`);
  }

  console.log("✅ testFreezeRemainsInCooling passed");
}

// ============================================================================
// TEST 2 — hard cooldown without signals → remain
// ============================================================================

function testHardCooldownWithoutSignalsRemains() {
  const input = makeInput({
    cooling: makeCooling({ coolingMode: "hard_cooldown" }),
    hasNewStabilitySignals: false,
  });

  const advisory = evaluateVoiceLoopRecoveryResume(input);

  if (advisory.resumeDecision !== "remain_in_cooling") {
    throw new Error(`Expected remain_in_cooling, got ${advisory.resumeDecision}`);
  }
  if (advisory.resumeMode !== "hold_position") {
    throw new Error(`Expected hold_position, got ${advisory.resumeMode}`);
  }
  if (advisory.readinessLevel !== "low") {
    throw new Error(`Expected low readiness, got ${advisory.readinessLevel}`);
  }

  console.log("✅ testHardCooldownWithoutSignalsRemains passed");
}

// ============================================================================
// TEST 3 — hard cooldown with signals → cautious
// ============================================================================

function testHardCooldownWithSignalsCautious() {
  const input = makeInput({
    cooling: makeCooling({ coolingMode: "hard_cooldown" }),
    hasNewStabilitySignals: true,
  });

  const advisory = evaluateVoiceLoopRecoveryResume(input);

  if (advisory.resumeDecision !== "resume_cautiously") {
    throw new Error(`Expected resume_cautiously, got ${advisory.resumeDecision}`);
  }
  if (advisory.resumeMode !== "gradual_resume") {
    throw new Error(`Expected gradual_resume, got ${advisory.resumeMode}`);
  }
  if (advisory.readinessLevel !== "medium") {
    throw new Error(`Expected medium readiness, got ${advisory.readinessLevel}`);
  }

  console.log("✅ testHardCooldownWithSignalsCautious passed");
}

// ============================================================================
// TEST 4 — soft cooldown → cautious
// ============================================================================

function testSoftCooldownCautious() {
  const input = makeInput({
    cooling: makeCooling({ coolingMode: "soft_cooldown" }),
    hasNewStabilitySignals: true,
  });

  const advisory = evaluateVoiceLoopRecoveryResume(input);

  if (advisory.resumeDecision !== "resume_cautiously") {
    throw new Error(`Expected resume_cautiously, got ${advisory.resumeDecision}`);
  }
  if (advisory.resumeMode !== "gradual_resume") {
    throw new Error(`Expected gradual_resume, got ${advisory.resumeMode}`);
  }
  if (advisory.readinessLevel !== "medium") {
    throw new Error(`Expected medium readiness, got ${advisory.readinessLevel}`);
  }

  console.log("✅ testSoftCooldownCautious passed");
}

// ============================================================================
// TEST 5 — no cooling → normal
// ============================================================================

function testNoCoolingNormal() {
  const input = makeInput({
    cooling: makeCooling({ coolingMode: "no_cooling" }),
    hasNewStabilitySignals: true,
  });

  const advisory = evaluateVoiceLoopRecoveryResume(input);

  if (advisory.resumeDecision !== "resume_normal") {
    throw new Error(`Expected resume_normal, got ${advisory.resumeDecision}`);
  }
  if (advisory.resumeMode !== "full_resume") {
    throw new Error(`Expected full_resume, got ${advisory.resumeMode}`);
  }
  if (advisory.readinessLevel !== "high") {
    throw new Error(`Expected high readiness, got ${advisory.readinessLevel}`);
  }

  console.log("✅ testNoCoolingNormal passed");
}

// ============================================================================
// TEST 6 — readinessLevel mapping
// ============================================================================

function testReadinessLevelMapping() {
  const freezeInput = makeInput({
    cooling: makeCooling({ coolingMode: "freeze_until_manual_review" }),
  });
  const hardNoSignalsInput = makeInput({
    cooling: makeCooling({ coolingMode: "hard_cooldown" }),
    hasNewStabilitySignals: false,
  });
  const hardWithSignalsInput = makeInput({
    cooling: makeCooling({ coolingMode: "hard_cooldown" }),
    hasNewStabilitySignals: true,
  });
  const softInput = makeInput({
    cooling: makeCooling({ coolingMode: "soft_cooldown" }),
  });
  const noCoolingInput = makeInput({
    cooling: makeCooling({ coolingMode: "no_cooling" }),
  });

  const freezeAdvisory = evaluateVoiceLoopRecoveryResume(freezeInput);
  const hardNoSignalsAdvisory = evaluateVoiceLoopRecoveryResume(hardNoSignalsInput);
  const hardWithSignalsAdvisory = evaluateVoiceLoopRecoveryResume(hardWithSignalsInput);
  const softAdvisory = evaluateVoiceLoopRecoveryResume(softInput);
  const noCoolingAdvisory = evaluateVoiceLoopRecoveryResume(noCoolingInput);

  if (freezeAdvisory.readinessLevel !== "low") {
    throw new Error(`Expected low for freeze, got ${freezeAdvisory.readinessLevel}`);
  }
  if (hardNoSignalsAdvisory.readinessLevel !== "low") {
    throw new Error(`Expected low for hard without signals, got ${hardNoSignalsAdvisory.readinessLevel}`);
  }
  if (hardWithSignalsAdvisory.readinessLevel !== "medium") {
    throw new Error(`Expected medium for hard with signals, got ${hardWithSignalsAdvisory.readinessLevel}`);
  }
  if (softAdvisory.readinessLevel !== "medium") {
    throw new Error(`Expected medium for soft, got ${softAdvisory.readinessLevel}`);
  }
  if (noCoolingAdvisory.readinessLevel !== "high") {
    throw new Error(`Expected high for no cooling, got ${noCoolingAdvisory.readinessLevel}`);
  }

  console.log("✅ testReadinessLevelMapping passed");
}

// ============================================================================
// TEST 7 — includes reasons/warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const freezeInput = makeInput({
    cooling: makeCooling({
      coolingMode: "freeze_until_manual_review",
      reasons: ["cooling_reason_a"],
      warnings: ["cooling_warning_a"],
    }),
  });
  const advisory = evaluateVoiceLoopRecoveryResume(freezeInput);

  if (advisory.reasons.length === 0) {
    throw new Error("Resume advisory should include reasons");
  }
  if (advisory.warnings.length === 0) {
    throw new Error("Resume advisory should include warnings");
  }
  if (!advisory.reasons.includes("cooling_reason_a")) {
    throw new Error("Resume advisory should propagate cooling reasons");
  }
  if (!advisory.warnings.includes("cooling_warning_a")) {
    throw new Error("Resume advisory should propagate cooling warnings");
  }
  if (!advisory.reasons.includes("cooling_policy_controls_resume")) {
    throw new Error("Resume advisory should include resume-specific reason");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 8 — formatter works
// ============================================================================

function testFormatterWorks() {
  const input = makeInput({
    cooling: makeCooling({ coolingMode: "freeze_until_manual_review" }),
  });
  const advisory = evaluateVoiceLoopRecoveryResume(input);
  const formatted = formatVoiceLoopRecoveryResumeAdvisory(advisory);

  if (!formatted.includes("🔁 Voice Loop Resume Advisory")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("decision:")) {
    throw new Error("Missing decision in formatted output");
  }
  if (!formatted.includes("mode:")) {
    throw new Error("Missing mode in formatted output");
  }
  if (!formatted.includes("readiness:")) {
    throw new Error("Missing readiness in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("instruction:")) {
    throw new Error("Missing instruction in formatted output");
  }

  console.log("✅ testFormatterWorks passed");
}

// ============================================================================
// TEST 9 — deterministic output
// ============================================================================

function testDeterministicOutput() {
  const input = makeInput({
    cooling: makeCooling({
      coolingMode: "hard_cooldown",
      reasons: ["reason_a"],
      warnings: ["warning_a"],
    }),
    hasNewStabilitySignals: true,
  });

  const a1 = evaluateVoiceLoopRecoveryResume(input);
  const a2 = evaluateVoiceLoopRecoveryResume(input);

  // Strip generatedAtMs for comparison
  const r1 = { ...a1, generatedAtMs: 0 };
  const r2 = { ...a2, generatedAtMs: 0 };

  if (JSON.stringify(r1) !== JSON.stringify(r2)) {
    throw new Error("Resume advisory should be deterministic");
  }

  console.log("✅ testDeterministicOutput passed");
}

// ============================================================================
// TEST 10 — no mutation
// ============================================================================

function testNoMutation() {
  const cooling = makeCooling({
    coolingMode: "soft_cooldown",
    reasons: ["cooling_reason"],
    warnings: ["cooling_warning"],
  });
  const input: EvaluateVoiceLoopRecoveryResumeInput = {
    cooling,
    hasNewStabilitySignals: true,
  };

  const originalCooling = JSON.stringify(input.cooling);

  evaluateVoiceLoopRecoveryResume(input);

  if (JSON.stringify(input.cooling) !== originalCooling) {
    throw new Error("Input cooling should not be mutated");
  }

  console.log("✅ testNoMutation passed");
}

// ============================================================================
// TEST 11 — summary contains meaningful text
// ============================================================================

function testSummaryContainsMeaningfulText() {
  const freezeInput = makeInput({
    cooling: makeCooling({ coolingMode: "freeze_until_manual_review" }),
  });
  const freezeAdvisory = evaluateVoiceLoopRecoveryResume(freezeInput);

  const noCoolingInput = makeInput({
    cooling: makeCooling({ coolingMode: "no_cooling" }),
  });
  const noCoolingAdvisory = evaluateVoiceLoopRecoveryResume(noCoolingInput);

  if (freezeAdvisory.summary.length < 20) {
    throw new Error("Freeze resume summary should be meaningful");
  }
  if (freezeAdvisory.resumeInstruction.length < 20) {
    throw new Error("Freeze resume instruction should be meaningful");
  }
  if (noCoolingAdvisory.summary.length < 20) {
    throw new Error("Normal resume summary should be meaningful");
  }
  if (noCoolingAdvisory.resumeInstruction.length < 20) {
    throw new Error("Normal resume instruction should be meaningful");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// TEST 12 — deduplicates and sorts reasons/warnings
// ============================================================================

function testDeduplicatesAndSortsReasonsAndWarnings() {
  const input = makeInput({
    cooling: makeCooling({
      coolingMode: "freeze_until_manual_review",
      reasons: ["duplicate_item", "cooling_reason"],
      warnings: ["duplicate_item", "cooling_warning"],
    }),
  });

  const advisory = evaluateVoiceLoopRecoveryResume(input);

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
// Run all tests
// ============================================================================

console.log("\n=== Voice Loop Recovery Resume Advisory Tests ===\n");

try {
  testFreezeRemainsInCooling();
  testHardCooldownWithoutSignalsRemains();
  testHardCooldownWithSignalsCautious();
  testSoftCooldownCautious();
  testNoCoolingNormal();
  testReadinessLevelMapping();
  testIncludesReasonsAndWarnings();
  testFormatterWorks();
  testDeterministicOutput();
  testNoMutation();
  testSummaryContainsMeaningfulText();
  testDeduplicatesAndSortsReasonsAndWarnings();

  console.log("\n✅ All voice loop recovery resume advisory tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
