import {
  evaluateVoicePolicyOverrideSafety,
  formatVoicePolicyOverrideSafetyGateResult,
  type VoicePolicyOverrideSafetyGateResult,
  type EvaluateVoicePolicyOverrideSafetyInput,
} from "../../../src/telegram/voicePolicyOverrideSafetyGate.js";
import type { VoiceLoopPolicyInjectionAdvisory } from "../../../src/telegram/voiceLoopPolicyInjectionAdvisory.js";
import type { VoiceRecheckLoopStabilityAdvisory } from "../../../src/telegram/voiceRecheckLoopStabilityAdvisory.js";

// ============================================================================
// helpers
// ============================================================================

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

function makeInput(
  overrides: Partial<EvaluateVoicePolicyOverrideSafetyInput>,
): EvaluateVoicePolicyOverrideSafetyInput {
  return {
    injection: overrides.injection ?? makeInjection({}),
    stability: overrides.stability ?? makeStability({}),
  };
}

// ============================================================================
// TEST 1 — blocks_hard_override_on_unstable
// ============================================================================

function testBlocksHardOverrideOnUnstable() {
  const input = makeInput({
    injection: makeInjection({ overrideDecision: "hard_override" }),
    stability: makeStability({ stabilityStatus: "unstable" }),
  });

  const result = evaluateVoicePolicyOverrideSafety(input);

  if (result.safetyDecision !== "block_override") {
    throw new Error(`Expected block_override, got ${result.safetyDecision}`);
  }
  if (result.effectiveOverride !== "blocked") {
    throw new Error(`Expected blocked, got ${result.effectiveOverride}`);
  }

  console.log("✅ testBlocksHardOverrideOnUnstable passed");
}

// ============================================================================
// TEST 2 — restricts_soft_override_on_unstable
// ============================================================================

function testRestrictsSoftOverrideOnUnstable() {
  const input = makeInput({
    injection: makeInjection({ overrideDecision: "soft_override" }),
    stability: makeStability({ stabilityStatus: "unstable" }),
  });

  const result = evaluateVoicePolicyOverrideSafety(input);

  if (result.safetyDecision !== "restrict_override") {
    throw new Error(`Expected restrict_override, got ${result.safetyDecision}`);
  }
  if (result.effectiveOverride !== "soft_limited") {
    throw new Error(`Expected soft_limited, got ${result.effectiveOverride}`);
  }

  console.log("✅ testRestrictsSoftOverrideOnUnstable passed");
}

// ============================================================================
// TEST 3 — restricts_hard_override_on_watch
// ============================================================================

function testRestrictsHardOverrideOnWatch() {
  const input = makeInput({
    injection: makeInjection({ overrideDecision: "hard_override" }),
    stability: makeStability({ stabilityStatus: "watch" }),
  });

  const result = evaluateVoicePolicyOverrideSafety(input);

  if (result.safetyDecision !== "restrict_override") {
    throw new Error(`Expected restrict_override, got ${result.safetyDecision}`);
  }
  if (result.effectiveOverride !== "hard_limited") {
    throw new Error(`Expected hard_limited, got ${result.effectiveOverride}`);
  }

  console.log("✅ testRestrictsHardOverrideOnWatch passed");
}

// ============================================================================
// TEST 4 — allows_override_on_stable
// ============================================================================

function testAllowsOverrideOnStable() {
  const input = makeInput({
    injection: makeInjection({ overrideDecision: "hard_override" }),
    stability: makeStability({ stabilityStatus: "stable" }),
  });

  const result = evaluateVoicePolicyOverrideSafety(input);

  if (result.safetyDecision !== "allow_override") {
    throw new Error(`Expected allow_override, got ${result.safetyDecision}`);
  }
  if (result.effectiveOverride !== "hard_limited") {
    throw new Error(`Expected hard_limited, got ${result.effectiveOverride}`);
  }

  console.log("✅ testAllowsOverrideOnStable passed");
}

// ============================================================================
// TEST 5 — allows_no_override_on_stable
// ============================================================================

function testAllowsNoOverrideOnStable() {
  const input = makeInput({
    injection: makeInjection({ overrideDecision: "no_override" }),
    stability: makeStability({ stabilityStatus: "stable" }),
  });

  const result = evaluateVoicePolicyOverrideSafety(input);

  if (result.safetyDecision !== "allow_override") {
    throw new Error(`Expected allow_override, got ${result.safetyDecision}`);
  }
  if (result.effectiveOverride !== "none") {
    throw new Error(`Expected none, got ${result.effectiveOverride}`);
  }

  console.log("✅ testAllowsNoOverrideOnStable passed");
}

// ============================================================================
// TEST 6 — allows_soft_override_on_stable
// ============================================================================

function testAllowsSoftOverrideOnStable() {
  const input = makeInput({
    injection: makeInjection({ overrideDecision: "soft_override" }),
    stability: makeStability({ stabilityStatus: "stable" }),
  });

  const result = evaluateVoicePolicyOverrideSafety(input);

  if (result.safetyDecision !== "allow_override") {
    throw new Error(`Expected allow_override, got ${result.safetyDecision}`);
  }
  if (result.effectiveOverride !== "soft_limited") {
    throw new Error(`Expected soft_limited, got ${result.effectiveOverride}`);
  }

  console.log("✅ testAllowsSoftOverrideOnStable passed");
}

// ============================================================================
// TEST 7 — sets_effective_override_correctly
// ============================================================================

function testSetsEffectiveOverrideCorrectly() {
  // unstable + hard → blocked
  const unstableHardInput = makeInput({
    injection: makeInjection({ overrideDecision: "hard_override" }),
    stability: makeStability({ stabilityStatus: "unstable" }),
  });
  const unstableHardResult = evaluateVoicePolicyOverrideSafety(unstableHardInput);

  // unstable + soft → soft_limited
  const unstableSoftInput = makeInput({
    injection: makeInjection({ overrideDecision: "soft_override" }),
    stability: makeStability({ stabilityStatus: "unstable" }),
  });
  const unstableSoftResult = evaluateVoicePolicyOverrideSafety(unstableSoftInput);

  // watch + hard → hard_limited
  const watchHardInput = makeInput({
    injection: makeInjection({ overrideDecision: "hard_override" }),
    stability: makeStability({ stabilityStatus: "watch" }),
  });
  const watchHardResult = evaluateVoicePolicyOverrideSafety(watchHardInput);

  // stable + no_override → none
  const stableNoneInput = makeInput({
    injection: makeInjection({ overrideDecision: "no_override" }),
    stability: makeStability({ stabilityStatus: "stable" }),
  });
  const stableNoneResult = evaluateVoicePolicyOverrideSafety(stableNoneInput);

  if (unstableHardResult.effectiveOverride !== "blocked") {
    throw new Error(`Expected blocked for unstable+hard, got ${unstableHardResult.effectiveOverride}`);
  }
  if (unstableSoftResult.effectiveOverride !== "soft_limited") {
    throw new Error(`Expected soft_limited for unstable+soft, got ${unstableSoftResult.effectiveOverride}`);
  }
  if (watchHardResult.effectiveOverride !== "hard_limited") {
    throw new Error(`Expected hard_limited for watch+hard, got ${watchHardResult.effectiveOverride}`);
  }
  if (stableNoneResult.effectiveOverride !== "none") {
    throw new Error(`Expected none for stable+none, got ${stableNoneResult.effectiveOverride}`);
  }

  console.log("✅ testSetsEffectiveOverrideCorrectly passed");
}

// ============================================================================
// TEST 8 — includes_reasons_and_warnings
// ============================================================================

function testIncludesReasonsAndWarnings() {
  const input = makeInput({
    injection: makeInjection({ overrideDecision: "hard_override" }),
    stability: makeStability({ stabilityStatus: "unstable" }),
  });

  const result = evaluateVoicePolicyOverrideSafety(input);

  if (result.reasons.length === 0) {
    throw new Error("Safety gate result should include reasons");
  }
  if (result.warnings.length === 0) {
    throw new Error("Safety gate result should include warnings");
  }
  if (!result.reasons.includes("unstable_loop_cannot_accept_hard_override")) {
    throw new Error("Safety gate should include block-specific reason");
  }
  if (!result.warnings.includes("external_override_attempted_on_unstable_loop")) {
    throw new Error("Safety gate should include block-specific warning");
  }

  console.log("✅ testIncludesReasonsAndWarnings passed");
}

// ============================================================================
// TEST 9 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const input = makeInput({
    injection: makeInjection({ overrideDecision: "hard_override" }),
    stability: makeStability({ stabilityStatus: "unstable" }),
  });

  const result = evaluateVoicePolicyOverrideSafety(input);
  const formatted = formatVoicePolicyOverrideSafetyGateResult(result);

  if (!formatted.includes("🛡️ Voice Policy Override Safety Gate")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("safety decision:")) {
    throw new Error("Missing safety decision in formatted output");
  }
  if (!formatted.includes("effective override:")) {
    throw new Error("Missing effective override in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("safety instruction:")) {
    throw new Error("Missing safety instruction in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 10 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const input = makeInput({
    injection: makeInjection({ overrideDecision: "soft_override" }),
    stability: makeStability({ stabilityStatus: "watch" }),
  });

  const r1 = evaluateVoicePolicyOverrideSafety(input);
  const r2 = evaluateVoicePolicyOverrideSafety(input);

  // Strip generatedAtMs for comparison
  const s1 = { ...r1, generatedAtMs: 0 };
  const s2 = { ...r2, generatedAtMs: 0 };

  if (JSON.stringify(s1) !== JSON.stringify(s2)) {
    throw new Error("Safety gate result should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 11 — does_not_mutate_input
// ============================================================================

function testDoesNotMutateInput() {
  const injection = makeInjection({
    overrideDecision: "hard_override",
    reasons: ["injection_reason"],
    warnings: ["injection_warning"],
  });
  const stability = makeStability({
    stabilityStatus: "unstable",
    reasons: ["stability_reason"],
    warnings: ["stability_warning"],
  });
  const input: EvaluateVoicePolicyOverrideSafetyInput = { injection, stability };

  const originalInjection = JSON.stringify(input.injection);
  const originalStability = JSON.stringify(input.stability);

  evaluateVoicePolicyOverrideSafety(input);

  if (JSON.stringify(input.injection) !== originalInjection) {
    throw new Error("Input injection should not be mutated");
  }
  if (JSON.stringify(input.stability) !== originalStability) {
    throw new Error("Input stability should not be mutated");
  }

  console.log("✅ testDoesNotMutateInput passed");
}

// ============================================================================
// TEST 12 — summary_contains_meaningful_text
// ============================================================================

function testSummaryContainsMeaningfulText() {
  const blockInput = makeInput({
    injection: makeInjection({ overrideDecision: "hard_override" }),
    stability: makeStability({ stabilityStatus: "unstable" }),
  });
  const blockResult = evaluateVoicePolicyOverrideSafety(blockInput);

  const allowInput = makeInput({
    injection: makeInjection({ overrideDecision: "soft_override" }),
    stability: makeStability({ stabilityStatus: "stable" }),
  });
  const allowResult = evaluateVoicePolicyOverrideSafety(allowInput);

  if (blockResult.summary.length < 20) {
    throw new Error("Block summary should be meaningful");
  }
  if (blockResult.safetyInstruction.length < 20) {
    throw new Error("Block safety instruction should be meaningful");
  }
  if (allowResult.summary.length < 20) {
    throw new Error("Allow summary should be meaningful");
  }
  if (allowResult.safetyInstruction.length < 20) {
    throw new Error("Allow safety instruction should be meaningful");
  }

  console.log("✅ testSummaryContainsMeaningfulText passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Policy Override Safety Gate Tests ===\n");

try {
  testBlocksHardOverrideOnUnstable();
  testRestrictsSoftOverrideOnUnstable();
  testRestrictsHardOverrideOnWatch();
  testAllowsOverrideOnStable();
  testAllowsNoOverrideOnStable();
  testAllowsSoftOverrideOnStable();
  testSetsEffectiveOverrideCorrectly();
  testIncludesReasonsAndWarnings();
  testFormatsOutputCorrectly();
  testReturnsDeterministicOutput();
  testDoesNotMutateInput();
  testSummaryContainsMeaningfulText();

  console.log("\n✅ All voice policy override safety gate tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
