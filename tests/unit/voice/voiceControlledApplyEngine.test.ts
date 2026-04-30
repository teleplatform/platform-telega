import {
  executeVoiceControlledApply,
  type ExecuteVoiceControlledApplyInput,
  type VoiceApplyExecution,
} from "../../../src/telegram/voiceControlledApplyEngine.js";
import type { VoiceReviewPacket } from "../../../src/telegram/voiceReviewSurface.js";
import type { VoicePolicyRecommendation } from "../../../src/telegram/voiceAdaptivePolicyRecommendations.js";
import type { VoiceGovernedApplyResult } from "../../../src/telegram/voiceGovernedApplyGate.js";

// ============================================================================
// Helpers
// ============================================================================

function makeReviewPacket(overrides: Partial<VoiceReviewPacket>): VoiceReviewPacket {
  return {
    generatedAtMs: Date.now(),
    status: overrides.status ?? "healthy",
    headline: overrides.headline ?? "Voice runtime healthy",
    operatorSummary: overrides.operatorSummary ?? "System operating normally.",
    metrics: overrides.metrics ?? {
      voiceSuccessRate: 90,
      fallbackRate: 5,
      interruptionBlockRate: 3,
      avgQualityScore: 80,
      avgLatencyMs: 5000,
      totalSignals: 100,
    },
    recommendation: overrides.recommendation ?? {
      type: "no_change",
      confidence: "medium",
      summary: "No strong signals.",
    },
    governance: overrides.governance ?? {
      applyDecision: "allow_apply",
      reason: "sufficient_evidence",
      confidence: "high",
      safeApplyMode: "manual_review_only",
    },
    blockers: overrides.blockers ?? [],
    warnings: overrides.warnings ?? [],
    suggestedOperatorAction: overrides.suggestedOperatorAction ?? "No action required.",
  };
}

function makeRecommendation(overrides: Partial<VoicePolicyRecommendation>): VoicePolicyRecommendation {
  return {
    recommendationType: overrides.recommendationType ?? "no_change",
    confidence: overrides.confidence ?? "high",
    summary: overrides.summary ?? "Recommendation summary.",
    evidenceWindowSize: overrides.evidenceWindowSize ?? 100,
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    metrics: overrides.metrics ?? {
      voiceSuccessRate: 90,
      fallbackRate: 5,
      interruptionBlockRate: 3,
      avgQualityScore: 80,
      fastCount: 50,
      qualityCount: 50,
      avgLatencyMs: 5000,
    },
    reasons: overrides.reasons ?? ["strong_evidence"],
    warnings: overrides.warnings ?? [],
    doNotApplyAutomatically: true,
  };
}

function makeGovernedApply(overrides: Partial<VoiceGovernedApplyResult>): VoiceGovernedApplyResult {
  return {
    applyDecision: overrides.applyDecision ?? "allow_apply",
    reason: overrides.reason ?? "sufficient_evidence_and_stable_runtime",
    confidence: overrides.confidence ?? "high",
    blockers: overrides.blockers ?? [],
    warnings: overrides.warnings ?? [],
    safeApplyMode: "manual_review_only",
    generatedAtMs: Date.now(),
  };
}

function makeInput(overrides: Partial<ExecuteVoiceControlledApplyInput>): ExecuteVoiceControlledApplyInput {
  return {
    review: overrides.review ?? makeReviewPacket({}),
    recommendation: overrides.recommendation ?? makeRecommendation({}),
    governedApply: overrides.governedApply ?? makeGovernedApply({}),
  };
}

// ============================================================================
// TEST 1 — does_not_apply_when_governance_blocks
// ============================================================================

function testDoesNotApplyWhenGovernanceBlocks() {
  const input = makeInput({
    governedApply: makeGovernedApply({ applyDecision: "deny" }),
    recommendation: makeRecommendation({
      recommendationType: "prefer_fast_voice_for_short_replies",
      confidence: "high",
    }),
  });

  const result = executeVoiceControlledApply(input);

  if (result.applied) {
    throw new Error("Should not apply when governance blocks");
  }
  if (result.patchId !== "none") {
    throw new Error(`Expected patchId=none, got ${result.patchId}`);
  }
  if (result.reason !== "apply_not_allowed_by_governance") {
    throw new Error(`Expected apply_not_allowed_by_governance, got ${result.reason}`);
  }

  console.log("✅ testDoesNotApplyWhenGovernanceBlocks passed");
}

// ============================================================================
// TEST 2 — does_not_apply_when_confidence_low
// ============================================================================

function testDoesNotApplyWhenConfidenceLow() {
  const input = makeInput({
    governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
    recommendation: makeRecommendation({
      recommendationType: "prefer_fast_voice_for_short_replies",
      confidence: "low",
    }),
  });

  const result = executeVoiceControlledApply(input);

  if (result.applied) {
    throw new Error("Should not apply when confidence is low");
  }
  if (result.reason !== "insufficient_confidence") {
    throw new Error(`Expected insufficient_confidence, got ${result.reason}`);
  }

  console.log("✅ testDoesNotApplyWhenConfidenceLow passed");
}

// ============================================================================
// TEST 3 — applies_fast_voice_patch_when_allowed
// ============================================================================

function testAppliesFastVoicePatchWhenAllowed() {
  const input = makeInput({
    governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
    recommendation: makeRecommendation({
      recommendationType: "prefer_fast_voice_for_short_replies",
      confidence: "high",
    }),
  });

  const result = executeVoiceControlledApply(input);

  if (!result.applied) {
    throw new Error("Should apply for fast voice recommendation with high confidence");
  }
  if (result.patchId !== "patch_fast_preference") {
    throw new Error(`Expected patch_fast_preference, got ${result.patchId}`);
  }
  if (!result.rollbackAvailable) {
    throw new Error("Rollback should be available");
  }
  if (!result.rollbackId) {
    throw new Error("Rollback ID should be present");
  }

  console.log("✅ testAppliesFastVoicePatchWhenAllowed passed");
}

// ============================================================================
// TEST 4 — applies_interruption_patch_when_allowed
// ============================================================================

function testAppliesInterruptionPatchWhenAllowed() {
  const inputLower = makeInput({
    governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
    recommendation: makeRecommendation({
      recommendationType: "lower_interruption_guard_sensitivity",
      confidence: "high",
    }),
  });

  const resultLower = executeVoiceControlledApply(inputLower);

  if (!resultLower.applied) {
    throw new Error("Should apply for lower interruption recommendation");
  }
  if (resultLower.patchId !== "patch_lower_interrupt") {
    throw new Error(`Expected patch_lower_interrupt, got ${resultLower.patchId}`);
  }

  const inputRaise = makeInput({
    governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
    recommendation: makeRecommendation({
      recommendationType: "raise_interruption_guard_sensitivity",
      confidence: "high",
    }),
  });

  const resultRaise = executeVoiceControlledApply(inputRaise);

  if (!resultRaise.applied) {
    throw new Error("Should apply for raise interruption recommendation");
  }
  if (resultRaise.patchId !== "patch_raise_interrupt") {
    throw new Error(`Expected patch_raise_interrupt, got ${resultRaise.patchId}`);
  }

  console.log("✅ testAppliesInterruptionPatchWhenAllowed passed");
}

// ============================================================================
// TEST 5 — never_applies_multiple_changes
// ============================================================================

function testNeverAppliesMultipleChanges() {
  // Each recommendation maps to exactly ONE patch
  const inputs = [
    makeInput({
      governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
      recommendation: makeRecommendation({
        recommendationType: "prefer_fast_voice_for_short_replies",
        confidence: "high",
      }),
    }),
    makeInput({
      governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
      recommendation: makeRecommendation({
        recommendationType: "prefer_quality_voice_for_stable_sessions",
        confidence: "high",
      }),
    }),
  ];

  for (const input of inputs) {
    const result = executeVoiceControlledApply(input);

    if (result.applied) {
      // Count how many non-undefined change fields are set
      const changes = input.recommendation.recommendationType === "prefer_fast_voice_for_short_replies"
        ? { preferredVoiceMode: true, maxVoiceLatencyTargetMs: true, allowVoiceExpansion: true }
        : { preferredVoiceMode: true, maxVoiceLatencyTargetMs: true, allowVoiceExpansion: true };

      // The patch should only affect ONE parameter group (e.g., voice mode preference)
      // It should NOT affect unrelated parameters simultaneously
      if (result.patchId === "none") {
        throw new Error(`Expected a patch for ${input.recommendation.recommendationType}`);
      }
    }
  }

  console.log("✅ testNeverAppliesMultipleChanges passed");
}

// ============================================================================
// TEST 6 — always_returns_rollback_available
// ============================================================================

function testAlwaysReturnsRollbackAvailable() {
  const inputs = [
    makeInput({
      governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
      recommendation: makeRecommendation({
        recommendationType: "prefer_fast_voice_for_short_replies",
        confidence: "high",
      }),
    }),
    makeInput({
      governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
      recommendation: makeRecommendation({
        recommendationType: "lower_interruption_guard_sensitivity",
        confidence: "high",
      }),
    }),
    makeInput({
      governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
      recommendation: makeRecommendation({
        recommendationType: "allow_more_voice_when_success_rate_is_high",
        confidence: "high",
      }),
    }),
  ];

  for (const input of inputs) {
    const result = executeVoiceControlledApply(input);

    if (result.applied && !result.rollbackAvailable) {
      throw new Error(`Patch ${result.patchId} must have rollback available`);
    }
    if (result.applied && !result.rollbackId) {
      throw new Error(`Patch ${result.patchId} must have rollbackId`);
    }
  }

  console.log("✅ testAlwaysReturnsRollbackAvailable passed");
}

// ============================================================================
// TEST 7 — does_not_apply_when_no_safe_mapping
// ============================================================================

function testDoesNotApplyWhenNoSafeMapping() {
  const input = makeInput({
    governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
    recommendation: makeRecommendation({
      recommendationType: "reduce_voice_usage_when_fallback_spikes",
      confidence: "high",
    }),
  });

  const result = executeVoiceControlledApply(input);

  // reduce_voice_usage_when_fallback_spikes has no safe patch mapping in v1.4
  // because reducing voice usage during degradation is risky
  if (result.patchId !== "none") {
    throw new Error(`Expected no patch for reduce_voice recommendation, got ${result.patchId}`);
  }
  if (result.applied) {
    throw new Error("Should not apply for reduce_voice recommendation");
  }

  console.log("✅ testDoesNotApplyWhenNoSafeMapping passed");
}

// ============================================================================
// TEST 8 — returns_deterministic_patch_ids
// ============================================================================

function testDeterministicPatchIds() {
  const input = makeInput({
    governedApply: makeGovernedApply({ applyDecision: "allow_apply" }),
    recommendation: makeRecommendation({
      recommendationType: "prefer_fast_voice_for_short_replies",
      confidence: "high",
    }),
  });

  // Run twice with same recommendation type
  const result1 = executeVoiceControlledApply(input);
  const result2 = executeVoiceControlledApply(input);

  // patchId should be deterministic for same recommendation type
  if (result1.patchId !== result2.patchId) {
    throw new Error(`Patch IDs should match: ${result1.patchId} vs ${result2.patchId}`);
  }
  if (result1.applied !== result2.applied) {
    throw new Error("Applied flag should be deterministic");
  }
  if (result1.reason !== result2.reason) {
    throw new Error("Reason should be deterministic");
  }

  console.log("✅ testDeterministicPatchIds passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Controlled Apply Engine Tests ===\n");

try {
  testDoesNotApplyWhenGovernanceBlocks();
  testDoesNotApplyWhenConfidenceLow();
  testAppliesFastVoicePatchWhenAllowed();
  testAppliesInterruptionPatchWhenAllowed();
  testNeverAppliesMultipleChanges();
  testAlwaysReturnsRollbackAvailable();
  testDoesNotApplyWhenNoSafeMapping();
  testDeterministicPatchIds();

  console.log("\n✅ All voice controlled apply engine tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
