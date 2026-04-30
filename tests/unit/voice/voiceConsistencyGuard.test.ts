import {
  evaluateVoiceConsistencyGuard,
  formatVoiceConsistencyGuardResult,
  buildConsistencyAnchor,
  type VoiceConsistencyGuardResult,
  type EvaluateVoiceConsistencyGuardInput,
} from "../../../src/telegram/voiceConsistencyGuard.js";
import type { VoiceEffectLineage, VoiceEffectRecord, VoiceAuditEnvelope } from "../../../src/telegram/voiceEffectLineageAuditEnvelope.js";
import { VOICE_GOVERNANCE_SOURCE_LAYERS } from "../../../src/telegram/voiceGovernanceTraceEvidence.js";

// ============================================================================
// helpers
// ============================================================================

function makeLineage(
  overrides: Partial<VoiceEffectLineage>,
): VoiceEffectLineage {
  return {
    traceId: overrides.traceId ?? "trace_test",
    intentId: overrides.intentId ?? "intent_test",
    decisionId: overrides.decisionId ?? "decision_test",
    reactionId: overrides.reactionId ?? "reaction_test",
    executionId: overrides.executionId ?? "exec_test",
    effectId: overrides.effectId ?? "effect_test",
    lineageChain: overrides.lineageChain ?? [],
    isComplete: overrides.isComplete ?? true,
    isSealed: overrides.isSealed ?? true,
  };
}

function makeEffect(
  overrides: Partial<VoiceEffectRecord>,
): VoiceEffectRecord {
  return {
    effectId: overrides.effectId ?? "effect_1",
    executionId: overrides.executionId ?? "exec_1",
    reactionId: overrides.reactionId ?? "no_action",
    status: overrides.status ?? "confirmed",
    confirmationType: overrides.confirmationType ?? "system_ack",
    confirmedAt: overrides.confirmedAt ?? Date.now(),
    evidenceRefs: overrides.evidenceRefs ?? [],
    isAnchor: overrides.isAnchor ?? true,
  };
}

function makeEnvelope(
  overrides: Partial<VoiceAuditEnvelope> = {},
): VoiceAuditEnvelope {
  const effect = overrides?.effect ?? makeEffect({});
  return {
    traceId: overrides?.traceId ?? "trace_test",
    lineage: overrides?.lineage ?? makeLineage({}),
    execution: overrides?.execution ?? {
      executionId: effect.executionId,
      startedAt: Date.now(),
      completedAt: Date.now(),
      status: "completed",
    },
    effect,
    anchors: overrides?.anchors ?? [],
    artifacts: overrides?.artifacts ?? [],
    governance: overrides?.governance ?? {
      policyScope: "voice_loop_low",
      decisionMode: "auto",
    },
    isValid: overrides?.isValid ?? true,
  };
}

function makeInput(
  overrides: Partial<EvaluateVoiceConsistencyGuardInput>,
): EvaluateVoiceConsistencyGuardInput {
  return {
    lineages: overrides.lineages ?? [],
    effects: overrides.effects ?? [],
    envelopes: overrides.envelopes ?? [],
  };
}

// ============================================================================
// TEST 1 — passes_when_single_effect_no_conflicts
// ============================================================================

function testPassesWhenSingleEffectNoConflicts() {
  const input = makeInput({
    lineages: [makeLineage({ effectId: "effect_1" })],
    effects: [makeEffect({ effectId: "effect_1", reactionId: "no_action" })],
    envelopes: [makeEnvelope()],
  });

  const result = evaluateVoiceConsistencyGuard(input);

  if (result.isConsistent !== true) {
    throw new Error("Should be consistent with single effect");
  }
  if (result.conflicts.length !== 0) {
    throw new Error("Should have no conflicts");
  }
  if (result.resolutionStrategy !== "allow_partial") {
    throw new Error(`Expected allow_partial, got ${result.resolutionStrategy}`);
  }

  console.log("✅ testPassesWhenSingleEffectNoConflicts passed");
}

// ============================================================================
// TEST 2 — passes_when_multiple_compatible_effects
// ============================================================================

function testPassesWhenMultipleCompatibleEffects() {
  const input = makeInput({
    lineages: [
      makeLineage({ effectId: "effect_1" }),
      makeLineage({ effectId: "effect_2" }),
    ],
    effects: [
      makeEffect({ effectId: "effect_1", reactionId: "increase_cooling" }),
      makeEffect({ effectId: "effect_2", reactionId: "request_human_review" }),
    ],
    envelopes: [makeEnvelope(), makeEnvelope()],
  });

  const result = evaluateVoiceConsistencyGuard(input);

  if (result.isConsistent !== true) {
    throw new Error("Should be consistent with compatible effects");
  }
  if (result.conflicts.length !== 0) {
    throw new Error("Should have no conflicts for compatible effects");
  }

  console.log("✅ testPassesWhenMultipleCompatibleEffects passed");
}

// ============================================================================
// TEST 3 — detects_state_conflict_protected_mode_and_override_unlock
// ============================================================================

function testDetectsStateConflictProtectedModeAndOverrideUnlock() {
  const input = makeInput({
    effects: [
      makeEffect({
        effectId: "effect_protected",
        reactionId: "protected_mode_entered",
      }),
      makeEffect({
        effectId: "effect_unlock",
        reactionId: "override_unlocked",
      }),
    ],
    lineages: [makeLineage({}), makeLineage({})],
    envelopes: [makeEnvelope(), makeEnvelope()],
  });

  const result = evaluateVoiceConsistencyGuard(input);

  if (result.isConsistent !== false) {
    throw new Error("Should detect state conflict");
  }
  const stateConflict = result.conflicts.find(
    (c) => c.type === "state_conflict",
  );
  if (!stateConflict) {
    throw new Error("Should have state_conflict type");
  }
  if (!stateConflict.effectIds.includes("effect_protected")) {
    throw new Error("State conflict should include protected mode effect");
  }
  if (!stateConflict.effectIds.includes("effect_unlock")) {
    throw new Error("State conflict should include override unlock effect");
  }
  if (result.resolutionStrategy !== "block_all") {
    throw new Error(`State conflicts should block_all, got ${result.resolutionStrategy}`);
  }

  console.log("✅ testDetectsStateConflictProtectedModeAndOverrideUnlock passed");
}

// ============================================================================
// TEST 4 — detects_policy_conflict_auto_on_human_governance
// ============================================================================

function testDetectsPolicyConflictAutoOnHumanGovernance() {
  const effect = makeEffect({
    effectId: "effect_auto",
    reactionId: "lock_override_channel",
    confirmationType: "system_ack",
    executionId: "exec_auto",
  });
  const envelope = makeEnvelope({
    governance: {
      policyScope: "voice_loop_high",
      decisionMode: "human",
    },
    effect,
    execution: {
      executionId: effect.executionId,
      startedAt: Date.now(),
      completedAt: Date.now(),
      status: "completed",
    },
  });

  const input = makeInput({
    effects: [effect],
    lineages: [makeLineage({})],
    envelopes: [envelope],
  });

  const result = evaluateVoiceConsistencyGuard(input);

  if (result.isConsistent !== false) {
    throw new Error("Should detect policy conflict");
  }
  const policyConflict = result.conflicts.find(
    (c) => c.type === "policy_conflict",
  );
  if (!policyConflict) {
    throw new Error("Should have policy_conflict type");
  }
  if (result.resolutionStrategy !== "require_human_review") {
    throw new Error(`Policy conflicts should require_human_review, got ${result.resolutionStrategy}`);
  }

  console.log("✅ testDetectsPolicyConflictAutoOnHumanGovernance passed");
}

// ============================================================================
// TEST 5 — blocks_all_on_state_conflict
// ============================================================================

function testBlocksAllOnStateConflict() {
  const input = makeInput({
    effects: [
      makeEffect({ effectId: "e1", reactionId: "protected_mode_entered" }),
      makeEffect({ effectId: "e2", reactionId: "override_unlocked" }),
    ],
    lineages: [makeLineage({}), makeLineage({})],
    envelopes: [makeEnvelope(), makeEnvelope()],
  });

  const result = evaluateVoiceConsistencyGuard(input);

  if (result.resolutionStrategy !== "block_all") {
    throw new Error(`Expected block_all for state conflict, got ${result.resolutionStrategy}`);
  }
  if (result.isConsistent !== false) {
    throw new Error("Should be inconsistent");
  }

  console.log("✅ testBlocksAllOnStateConflict passed");
}

// ============================================================================
// TEST 6 — allows_partial_on_non_state_conflict
// ============================================================================

function testAllowsPartialOnNonStateConflict() {
  // No policy conflict (auto governance mode), no state conflict
  // Just a case where we have multiple effects that don't conflict
  const input = makeInput({
    effects: [
      makeEffect({ effectId: "e1", reactionId: "increase_cooling" }),
      makeEffect({ effectId: "e2", reactionId: "lock_override_channel" }),
    ],
    lineages: [makeLineage({}), makeLineage({})],
    envelopes: [makeEnvelope(), makeEnvelope()],
  });

  const result = evaluateVoiceConsistencyGuard(input);

  if (result.isConsistent !== true) {
    throw new Error("Should be consistent for compatible effects");
  }
  if (result.resolutionStrategy !== "allow_partial") {
    throw new Error(`Expected allow_partial, got ${result.resolutionStrategy}`);
  }

  console.log("✅ testAllowsPartialOnNonStateConflict passed");
}

// ============================================================================
// TEST 7 — summary_and_instruction_are_meaningful
// ============================================================================

function testSummaryAndInstructionAreMeaningful() {
  const consistentInput = makeInput({
    effects: [makeEffect({ reactionId: "no_action" })],
    lineages: [makeLineage({})],
    envelopes: [makeEnvelope()],
  });
  const consistentResult = evaluateVoiceConsistencyGuard(consistentInput);

  if (consistentResult.summary.length < 20) {
    throw new Error("Consistent summary should be meaningful");
  }
  if (consistentResult.guardInstruction.length < 20) {
    throw new Error("Guard instruction should be meaningful");
  }

  const conflictInput = makeInput({
    effects: [
      makeEffect({ effectId: "e1", reactionId: "protected_mode_entered" }),
      makeEffect({ effectId: "e2", reactionId: "override_unlocked" }),
    ],
    lineages: [makeLineage({}), makeLineage({})],
    envelopes: [makeEnvelope(), makeEnvelope()],
  });
  const conflictResult = evaluateVoiceConsistencyGuard(conflictInput);

  if (conflictResult.summary.length < 20) {
    throw new Error("Conflict summary should be meaningful");
  }
  if (conflictResult.guardInstruction.length < 20) {
    throw new Error("Guard instruction should be meaningful");
  }

  console.log("✅ testSummaryAndInstructionAreMeaningful passed");
}

// ============================================================================
// TEST 8 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const input = makeInput({
    effects: [
      makeEffect({ effectId: "e1", reactionId: "protected_mode_entered" }),
      makeEffect({ effectId: "e2", reactionId: "override_unlocked" }),
    ],
    lineages: [makeLineage({}), makeLineage({})],
    envelopes: [makeEnvelope(), makeEnvelope()],
  });

  const result = evaluateVoiceConsistencyGuard(input);
  const formatted = formatVoiceConsistencyGuardResult(result);

  if (!formatted.includes("🛡️ Voice Consistency Guard")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("consistent:")) {
    throw new Error("Missing consistent flag in formatted output");
  }
  if (!formatted.includes("conflicts:")) {
    throw new Error("Missing conflicts count in formatted output");
  }
  if (!formatted.includes("resolution:")) {
    throw new Error("Missing resolution in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("instruction:")) {
    throw new Error("Missing instruction in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 9 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const input = makeInput({
    effects: [makeEffect({ reactionId: "no_action" })],
    lineages: [makeLineage({})],
    envelopes: [makeEnvelope()],
  });

  const result1 = evaluateVoiceConsistencyGuard(input);
  const result2 = evaluateVoiceConsistencyGuard(input);

  // Strip timestamp and orchestration ID for comparison
  const r1 = { ...result1, evaluatedAt: 0, orchestrationId: "test" };
  const r2 = { ...result2, evaluatedAt: 0, orchestrationId: "test" };

  if (JSON.stringify(r1) !== JSON.stringify(r2)) {
    throw new Error("Consistency guard result should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 10 — does_not_mutate_input
// ============================================================================

function testDoesNotMutateInput() {
  const effect = makeEffect({
    reactionId: "protected_mode_entered",
    status: "confirmed",
  });
  const input = makeInput({
    effects: [effect],
    lineages: [makeLineage({})],
    envelopes: [makeEnvelope()],
  });

  const originalEffects = JSON.stringify(input.effects);

  evaluateVoiceConsistencyGuard(input);

  if (JSON.stringify(input.effects) !== originalEffects) {
    throw new Error("Input effects should not be mutated");
  }

  console.log("✅ testDoesNotMutateInput passed");
}

// ============================================================================
// TEST 11 — builds_consistency_anchor
// ============================================================================

function testBuildsConsistencyAnchor() {
  const input = makeInput({
    effects: [makeEffect({ reactionId: "no_action" })],
    lineages: [makeLineage({})],
    envelopes: [makeEnvelope()],
  });

  const result = evaluateVoiceConsistencyGuard(input);
  const anchor = buildConsistencyAnchor(result, result.orchestrationId);

  if (anchor.anchorType !== "consistency_passed") {
    throw new Error(`Expected consistency_passed anchor, got ${anchor.anchorType}`);
  }
  if (anchor.refId !== result.orchestrationId) {
    throw new Error("Anchor refId should match orchestrationId");
  }
  if (anchor.timestamp !== result.evaluatedAt) {
    throw new Error("Anchor timestamp should match evaluatedAt");
  }

  // Test with conflict
  const conflictInput = makeInput({
    effects: [
      makeEffect({ effectId: "e1", reactionId: "protected_mode_entered" }),
      makeEffect({ effectId: "e2", reactionId: "override_unlocked" }),
    ],
    lineages: [makeLineage({}), makeLineage({})],
    envelopes: [makeEnvelope(), makeEnvelope()],
  });

  const conflictResult = evaluateVoiceConsistencyGuard(conflictInput);
  const conflictAnchor = buildConsistencyAnchor(conflictResult, conflictResult.orchestrationId);

  if (conflictAnchor.anchorType !== "consistency_failed") {
    throw new Error(`Expected consistency_failed anchor, got ${conflictAnchor.anchorType}`);
  }

  console.log("✅ testBuildsConsistencyAnchor passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Consistency Guard & Cross-Lineage Validation Tests ===\n");

try {
  testPassesWhenSingleEffectNoConflicts();
  testPassesWhenMultipleCompatibleEffects();
  testDetectsStateConflictProtectedModeAndOverrideUnlock();
  testDetectsPolicyConflictAutoOnHumanGovernance();
  testBlocksAllOnStateConflict();
  testAllowsPartialOnNonStateConflict();
  testSummaryAndInstructionAreMeaningful();
  testFormatsOutputCorrectly();
  testReturnsDeterministicOutput();
  testDoesNotMutateInput();
  testBuildsConsistencyAnchor();

  console.log("\n✅ All voice consistency guard tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
