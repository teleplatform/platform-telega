import {
  buildVoiceGovernanceTrace,
  formatVoiceGovernanceTraceExplanation,
  type VoiceGovernanceTraceExplanation,
  type BuildVoiceGovernanceTraceInput,
} from "../../../src/telegram/voiceGovernanceTraceExplanation.js";
import type { VoiceRecheckLoopStabilityAdvisory } from "../../../src/telegram/voiceRecheckLoopStabilityAdvisory.js";
import type { VoiceLoopPressureResponseAdvisory } from "../../../src/telegram/voiceLoopPressureResponseAdvisory.js";
import type { VoiceLoopCoolingPolicyAdvisory } from "../../../src/telegram/voiceLoopCoolingPolicyAdvisory.js";
import type { VoiceLoopRecoveryResumeAdvisory } from "../../../src/telegram/voiceLoopRecoveryResumeAdvisory.js";
import type { VoiceLoopPolicyInjectionAdvisory } from "../../../src/telegram/voiceLoopPolicyInjectionAdvisory.js";
import type { VoicePolicyOverrideSafetyGateResult } from "../../../src/telegram/voicePolicyOverrideSafetyGate.js";

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
    summary: overrides.summary ?? "Loop stability advisory.",
    advisoryInstruction: overrides.advisoryInstruction ?? "Safe to continue.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

function makeResponse(
  overrides: Partial<VoiceLoopPressureResponseAdvisory>,
): VoiceLoopPressureResponseAdvisory {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    response: overrides.response ?? "no_action",
    recommendedAction: overrides.recommendedAction ?? "keep_current_strategy",
    severity: overrides.severity ?? "low",
    summary: overrides.summary ?? "Pressure response advisory.",
    responseInstruction: overrides.responseInstruction ?? "Keep current policy.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

function makeCooling(
  overrides: Partial<VoiceLoopCoolingPolicyAdvisory>,
): VoiceLoopCoolingPolicyAdvisory {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    coolingMode: overrides.coolingMode ?? "no_cooling",
    coolingWindowMs: overrides.coolingWindowMs ?? null,
    strictness: overrides.strictness ?? "low",
    summary: overrides.summary ?? "Cooling policy advisory.",
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
    summary: overrides.summary ?? "Resume advisory.",
    resumeInstruction: overrides.resumeInstruction ?? "Resume at normal cadence.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

function makeInjection(
  overrides: Partial<VoiceLoopPolicyInjectionAdvisory>,
): VoiceLoopPolicyInjectionAdvisory {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    overrideDecision: overrides.overrideDecision ?? "no_override",
    effectiveSignal: overrides.effectiveSignal ?? "none",
    policyDirection: overrides.policyDirection ?? "keep_internal_policy",
    severity: overrides.severity ?? "low",
    summary: overrides.summary ?? "Policy injection advisory.",
    policyInstruction: overrides.policyInstruction ?? "Continue internal policy.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

function makeSafety(
  overrides: Partial<VoicePolicyOverrideSafetyGateResult>,
): VoicePolicyOverrideSafetyGateResult {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    safetyDecision: overrides.safetyDecision ?? "allow_override",
    effectiveOverride: overrides.effectiveOverride ?? "none",
    summary: overrides.summary ?? "Safety gate result.",
    safetyInstruction: overrides.safetyInstruction ?? "Allow override.",
    reasons: overrides.reasons ?? [],
    warnings: overrides.warnings ?? [],
  };
}

function makeInput(
  overrides: Partial<BuildVoiceGovernanceTraceInput>,
): BuildVoiceGovernanceTraceInput {
  return {
    stability: overrides.stability ?? makeStability({}),
    response: overrides.response ?? makeResponse({}),
    cooling: overrides.cooling ?? makeCooling({}),
    resume: overrides.resume ?? makeResume({}),
    injection: overrides.injection ?? makeInjection({}),
    safety: overrides.safety ?? makeSafety({}),
  };
}

// ============================================================================
// TEST 1 — builds_trace_for_unstable_loop_with_blocked_override
// ============================================================================

function testBuildsTraceForUnstableLoopWithBlockedOverride() {
  const input = makeInput({
    stability: makeStability({ stabilityStatus: "unstable" }),
    response: makeResponse({ response: "freeze_loop" }),
    cooling: makeCooling({ coolingMode: "freeze_until_manual_review", strictness: "high" }),
    resume: makeResume({ resumeDecision: "remain_in_cooling" }),
    injection: makeInjection({ overrideDecision: "hard_override" }),
    safety: makeSafety({ safetyDecision: "block_override" }),
  });

  const trace = buildVoiceGovernanceTrace(input);

  if (trace.riskLevel !== "high") {
    throw new Error(`Expected high risk, got ${trace.riskLevel}`);
  }
  if (!trace.finalDecisionSummary.toLowerCase().includes("frozen") &&
      !trace.finalDecisionSummary.toLowerCase().includes("blocked")) {
    throw new Error("Summary should mention frozen/blocked state");
  }
  if (trace.explanationSteps.length !== 6) {
    throw new Error(`Expected 6 explanation steps, got ${trace.explanationSteps.length}`);
  }
  if (!trace.keyDrivers.includes("loop instability")) {
    throw new Error("Key drivers should include loop instability");
  }
  if (!trace.keyDrivers.includes("safety gate blocked external override")) {
    throw new Error("Key drivers should include safety block");
  }

  console.log("✅ testBuildsTraceForUnstableLoopWithBlockedOverride passed");
}

// ============================================================================
// TEST 2 — builds_trace_for_stable_loop_with_no_override
// ============================================================================

function testBuildsTraceForStableLoopWithNoOverride() {
  const input = makeInput({
    stability: makeStability({ stabilityStatus: "stable" }),
    response: makeResponse({ response: "no_action" }),
    cooling: makeCooling({ coolingMode: "no_cooling", strictness: "low" }),
    resume: makeResume({ resumeDecision: "resume_normal" }),
    injection: makeInjection({ overrideDecision: "no_override" }),
    safety: makeSafety({ safetyDecision: "allow_override" }),
  });

  const trace = buildVoiceGovernanceTrace(input);

  if (trace.riskLevel !== "low") {
    throw new Error(`Expected low risk, got ${trace.riskLevel}`);
  }
  if (!trace.finalDecisionSummary.toLowerCase().includes("stable")) {
    throw new Error("Summary should mention stable state");
  }
  if (trace.keyDrivers.length !== 1 || !trace.keyDrivers[0].includes("stable")) {
    throw new Error("Key drivers should indicate stable loop with no intervention");
  }

  console.log("✅ testBuildsTraceForStableLoopWithNoOverride passed");
}

// ============================================================================
// TEST 3 — builds_trace_for_watch_with_restricted_override
// ============================================================================

function testBuildsTraceForWatchWithRestrictedOverride() {
  const input = makeInput({
    stability: makeStability({ stabilityStatus: "watch" }),
    response: makeResponse({ response: "slow_down_loop" }),
    cooling: makeCooling({ coolingMode: "hard_cooldown", strictness: "high" }),
    resume: makeResume({ resumeDecision: "resume_cautiously" }),
    injection: makeInjection({ overrideDecision: "hard_override" }),
    safety: makeSafety({ safetyDecision: "restrict_override" }),
  });

  const trace = buildVoiceGovernanceTrace(input);

  if (trace.riskLevel !== "medium") {
    throw new Error(`Expected medium risk for watch+restricted, got ${trace.riskLevel}`);
  }
  if (trace.keyDrivers.length < 2) {
    throw new Error("Key drivers should include multiple drivers for watch state");
  }

  console.log("✅ testBuildsTraceForWatchWithRestrictedOverride passed");
}

// ============================================================================
// TEST 4 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const input = makeInput({
    stability: makeStability({ stabilityStatus: "unstable" }),
    safety: makeSafety({ safetyDecision: "block_override" }),
  });

  const trace = buildVoiceGovernanceTrace(input);
  const formatted = formatVoiceGovernanceTraceExplanation(trace);

  if (!formatted.includes("📋 Voice Governance Trace Explanation")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("risk level:")) {
    throw new Error("Missing risk level in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("Explanation steps:")) {
    throw new Error("Missing explanation steps section");
  }
  if (!formatted.includes("Key drivers:")) {
    throw new Error("Missing key drivers section");
  }
  if (!formatted.includes("Full explanation:")) {
    throw new Error("Missing full explanation section");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 5 — explanation_steps_cover_all_layers
// ============================================================================

function testExplanationStepsCoverAllLayers() {
  const input = makeInput({
    stability: makeStability({ stabilityStatus: "watch" }),
    response: makeResponse({ response: "slow_down_loop" }),
    cooling: makeCooling({ coolingMode: "soft_cooldown" }),
    resume: makeResume({ resumeDecision: "resume_cautiously" }),
    injection: makeInjection({ overrideDecision: "soft_override" }),
    safety: makeSafety({ safetyDecision: "allow_override" }),
  });

  const trace = buildVoiceGovernanceTrace(input);

  const combinedSteps = trace.explanationSteps.join(" ");

  // Should mention all 6 governance layers
  if (!combinedSteps.toLowerCase().includes("stability")) {
    throw new Error("Explanation should cover stability layer");
  }
  if (!combinedSteps.toLowerCase().includes("pressure")) {
    throw new Error("Explanation should cover pressure response layer");
  }
  if (!combinedSteps.toLowerCase().includes("cooling")) {
    throw new Error("Explanation should cover cooling policy layer");
  }
  if (!combinedSteps.toLowerCase().includes("resume")) {
    throw new Error("Explanation should cover resume decision layer");
  }
  if (!combinedSteps.toLowerCase().includes("policy") || !combinedSteps.toLowerCase().includes("external")) {
    throw new Error("Explanation should cover external policy layer");
  }
  if (!combinedSteps.toLowerCase().includes("safety")) {
    throw new Error("Explanation should cover safety gate layer");
  }

  console.log("✅ testExplanationStepsCoverAllLayers passed");
}

// ============================================================================
// TEST 6 — key_drivers_includes_all_active_factors
// ============================================================================

function testKeyDriversIncludesAllActiveFactors() {
  const input = makeInput({
    stability: makeStability({ stabilityStatus: "unstable" }),
    response: makeResponse({ response: "freeze_loop" }),
    injection: makeInjection({ overrideDecision: "hard_override" }),
    safety: makeSafety({ safetyDecision: "block_override" }),
  });

  const trace = buildVoiceGovernanceTrace(input);

  if (!trace.keyDrivers.includes("loop instability")) {
    throw new Error("Should include instability driver");
  }
  if (!trace.keyDrivers.some(d => d.includes("freeze"))) {
    throw new Error("Should include freeze driver");
  }
  if (!trace.keyDrivers.some(d => d.includes("override"))) {
    throw new Error("Should include override driver");
  }
  if (!trace.keyDrivers.some(d => d.includes("blocked"))) {
    throw new Error("Should include safety block driver");
  }

  console.log("✅ testKeyDriversIncludesAllActiveFactors passed");
}

// ============================================================================
// TEST 7 — risk_level_high_for_block_override
// ============================================================================

function testRiskLevelHighForBlockOverride() {
  const input = makeInput({
    stability: makeStability({ stabilityStatus: "stable" }),
    cooling: makeCooling({ coolingMode: "no_cooling", strictness: "low" }),
    injection: makeInjection({ overrideDecision: "hard_override" }),
    safety: makeSafety({ safetyDecision: "block_override" }),
  });

  const trace = buildVoiceGovernanceTrace(input);

  if (trace.riskLevel !== "high") {
    throw new Error(`Expected high risk for block_override, got ${trace.riskLevel}`);
  }

  console.log("✅ testRiskLevelHighForBlockOverride passed");
}

// ============================================================================
// TEST 8 — risk_level_medium_for_hard_cooling
// ============================================================================

function testRiskLevelMediumForHardCooling() {
  const input = makeInput({
    stability: makeStability({ stabilityStatus: "stable" }),
    cooling: makeCooling({ coolingMode: "hard_cooldown", strictness: "high" }),
    injection: makeInjection({ overrideDecision: "no_override" }),
    safety: makeSafety({ safetyDecision: "allow_override" }),
  });

  const trace = buildVoiceGovernanceTrace(input);

  if (trace.riskLevel !== "medium") {
    throw new Error(`Expected medium risk for hard cooling on stable, got ${trace.riskLevel}`);
  }

  console.log("✅ testRiskLevelMediumForHardCooling passed");
}

// ============================================================================
// TEST 9 — explanation_text_is_human_readable
// ============================================================================

function testExplanationTextIsHumanReadable() {
  const input = makeInput({
    stability: makeStability({ stabilityStatus: "unstable" }),
    response: makeResponse({ response: "freeze_loop" }),
    cooling: makeCooling({ coolingMode: "freeze_until_manual_review" }),
    resume: makeResume({ resumeDecision: "remain_in_cooling" }),
    injection: makeInjection({ overrideDecision: "hard_override" }),
    safety: makeSafety({ safetyDecision: "block_override" }),
  });

  const trace = buildVoiceGovernanceTrace(input);

  if (trace.explanationText.length < 50) {
    throw new Error("Explanation text should be meaningful and descriptive");
  }
  if (!trace.explanationText.includes(".")) {
    throw new Error("Explanation text should be sentence-based");
  }

  console.log("✅ testExplanationTextIsHumanReadable passed");
}

// ============================================================================
// TEST 10 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const input = makeInput({
    stability: makeStability({ stabilityStatus: "watch" }),
    response: makeResponse({ response: "slow_down_loop" }),
    cooling: makeCooling({ coolingMode: "soft_cooldown" }),
    resume: makeResume({ resumeDecision: "resume_cautiously" }),
    injection: makeInjection({ overrideDecision: "soft_override" }),
    safety: makeSafety({ safetyDecision: "allow_override" }),
  });

  const t1 = buildVoiceGovernanceTrace(input);
  const t2 = buildVoiceGovernanceTrace(input);

  // Strip generatedAtMs for comparison
  const e1 = { ...t1, generatedAtMs: 0 };
  const e2 = { ...t2, generatedAtMs: 0 };

  if (JSON.stringify(e1) !== JSON.stringify(e2)) {
    throw new Error("Governance trace should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 11 — does_not_mutate_input
// ============================================================================

function testDoesNotMutateInput() {
  const stability = makeStability({
    stabilityStatus: "unstable",
    reasons: ["stability_reason"],
    warnings: ["stability_warning"],
  });
  const response = makeResponse({
    response: "freeze_loop",
    reasons: ["response_reason"],
    warnings: ["response_warning"],
  });
  const input: BuildVoiceGovernanceTraceInput = {
    stability,
    response,
    cooling: makeCooling({}),
    resume: makeResume({}),
    injection: makeInjection({}),
    safety: makeSafety({}),
  };

  const originalStability = JSON.stringify(input.stability);
  const originalResponse = JSON.stringify(input.response);

  buildVoiceGovernanceTrace(input);

  if (JSON.stringify(input.stability) !== originalStability) {
    throw new Error("Input stability should not be mutated");
  }
  if (JSON.stringify(input.response) !== originalResponse) {
    throw new Error("Input response should not be mutated");
  }

  console.log("✅ testDoesNotMutateInput passed");
}

// ============================================================================
// TEST 12 — explanation_text_covers_full_governance_chain
// ============================================================================

function testExplanationTextCoversFullGovernanceChain() {
  const input = makeInput({
    stability: makeStability({ stabilityStatus: "unstable" }),
    response: makeResponse({ response: "freeze_loop" }),
    cooling: makeCooling({ coolingMode: "freeze_until_manual_review" }),
    resume: makeResume({ resumeDecision: "remain_in_cooling" }),
    injection: makeInjection({ overrideDecision: "hard_override" }),
    safety: makeSafety({ safetyDecision: "block_override" }),
  });

  const trace = buildVoiceGovernanceTrace(input);
  const text = trace.explanationText.toLowerCase();

  // Should mention key governance concepts
  if (!text.includes("unstable")) {
    throw new Error("Explanation should mention unstable state");
  }
  if (!text.includes("freeze")) {
    throw new Error("Explanation should mention freeze response");
  }
  if (!text.includes("override")) {
    throw new Error("Explanation should mention override");
  }

  console.log("✅ testExplanationTextCoversFullGovernanceChain passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Governance Trace Explanation Tests ===\n");

try {
  testBuildsTraceForUnstableLoopWithBlockedOverride();
  testBuildsTraceForStableLoopWithNoOverride();
  testBuildsTraceForWatchWithRestrictedOverride();
  testFormatsOutputCorrectly();
  testExplanationStepsCoverAllLayers();
  testKeyDriversIncludesAllActiveFactors();
  testRiskLevelHighForBlockOverride();
  testRiskLevelMediumForHardCooling();
  testExplanationTextIsHumanReadable();
  testReturnsDeterministicOutput();
  testDoesNotMutateInput();
  testExplanationTextCoversFullGovernanceChain();

  console.log("\n✅ All voice governance trace explanation tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
