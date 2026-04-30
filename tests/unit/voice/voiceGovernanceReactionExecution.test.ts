import {
  executeVoiceGovernanceReaction,
  formatVoiceGovernanceReactionExecutionResult,
  type VoiceGovernanceReactionExecutionResult,
} from "../../../src/telegram/voiceGovernanceReactionExecution.js";
import type { VoiceGovernanceReactionResult } from "../../../src/telegram/voiceGovernanceReactionLayer.js";

// ============================================================================
// helpers
// ============================================================================

function makeReaction(
  overrides: Partial<VoiceGovernanceReactionResult>,
): VoiceGovernanceReactionResult {
  return {
    decidedAtMs: overrides.decidedAtMs ?? Date.now(),
    action: overrides.action ?? "no_action",
    reason: overrides.reason ?? "No reaction needed.",
    severity: overrides.severity ?? "low",
    triggeredBy: overrides.triggeredBy ?? [],
    summary: overrides.summary ?? "No action required.",
    reactionInstruction: overrides.reactionInstruction ?? "Continue normal operation.",
  };
}

// ============================================================================
// TEST 1 — executes_lock_override_channel
// ============================================================================

async function testExecutesLockOverrideChannel() {
  const reaction = makeReaction({ action: "lock_override_channel" });

  const result = await executeVoiceGovernanceReaction(reaction);

  if (result.status !== "completed") {
    throw new Error(`Expected completed status, got ${result.status}`);
  }
  if (result.effectConfirmed !== true) {
    throw new Error("Expected effectConfirmed to be true");
  }
  if (result.effectType !== "override_locked") {
    throw new Error(`Expected override_locked, got ${result.effectType}`);
  }
  if (!result.executionId.startsWith("voice_exec_")) {
    throw new Error(`Execution ID should start with voice_exec_, got ${result.executionId}`);
  }

  console.log("✅ testExecutesLockOverrideChannel passed");
}

// ============================================================================
// TEST 2 — executes_increase_cooling
// ============================================================================

async function testExecutesIncreaseCooling() {
  const reaction = makeReaction({ action: "increase_cooling" });

  const result = await executeVoiceGovernanceReaction(reaction);

  if (result.effectType !== "cooling_increased") {
    throw new Error(`Expected cooling_increased, got ${result.effectType}`);
  }
  if (result.effectConfirmed !== true) {
    throw new Error("Expected effectConfirmed to be true");
  }

  console.log("✅ testExecutesIncreaseCooling passed");
}

// ============================================================================
// TEST 3 — executes_enter_protected_mode
// ============================================================================

async function testExecutesEnterProtectedMode() {
  const reaction = makeReaction({ action: "enter_protected_mode" });

  const result = await executeVoiceGovernanceReaction(reaction);

  if (result.effectType !== "protected_mode_entered") {
    throw new Error(`Expected protected_mode_entered, got ${result.effectType}`);
  }
  if (result.effectConfirmed !== true) {
    throw new Error("Expected effectConfirmed to be true");
  }

  console.log("✅ testExecutesEnterProtectedMode passed");
}

// ============================================================================
// TEST 4 — executes_request_human_review
// ============================================================================

async function testExecutesRequestHumanReview() {
  const reaction = makeReaction({ action: "request_human_review" });

  const result = await executeVoiceGovernanceReaction(reaction);

  if (result.effectType !== "human_review_requested") {
    throw new Error(`Expected human_review_requested, got ${result.effectType}`);
  }
  if (result.effectConfirmed !== true) {
    throw new Error("Expected effectConfirmed to be true");
  }

  console.log("✅ testExecutesRequestHumanReview passed");
}

// ============================================================================
// TEST 5 — executes_escalate_to_creator
// ============================================================================

async function testExecutesEscalateToCreator() {
  const reaction = makeReaction({ action: "escalate_to_creator" });

  const result = await executeVoiceGovernanceReaction(reaction);

  if (result.effectType !== "escalated_to_creator") {
    throw new Error(`Expected escalated_to_creator, got ${result.effectType}`);
  }
  if (result.effectConfirmed !== true) {
    throw new Error("Expected effectConfirmed to be true");
  }

  console.log("✅ testExecutesEscalateToCreator passed");
}

// ============================================================================
// TEST 6 — executes_no_action_without_confirmation
// ============================================================================

async function testExecutesNoActionWithoutConfirmation() {
  const reaction = makeReaction({ action: "no_action" });

  const result = await executeVoiceGovernanceReaction(reaction);

  if (result.effectType !== "no_effect") {
    throw new Error(`Expected no_effect, got ${result.effectType}`);
  }
  if (result.effectConfirmed !== false) {
    throw new Error("Expected effectConfirmed to be false for no_action");
  }

  console.log("✅ testExecutesNoActionWithoutConfirmation passed");
}

// ============================================================================
// TEST 7 — execution_id_is_unique
// ============================================================================

async function testExecutionIdIsUnique() {
  const reaction = makeReaction({ action: "no_action" });

  const result1 = await executeVoiceGovernanceReaction(reaction);
  const result2 = await executeVoiceGovernanceReaction(reaction);

  if (result1.executionId === result2.executionId) {
    throw new Error("Execution IDs should be unique");
  }

  console.log("✅ testExecutionIdIsUnique passed");
}

// ============================================================================
// TEST 8 — completed_at_is_set
// ============================================================================

async function testCompletedAtIsSet() {
  const reaction = makeReaction({ action: "lock_override_channel" });

  const result = await executeVoiceGovernanceReaction(reaction);

  if (result.completedAtMs === undefined) {
    throw new Error("completedAtMs should be set for completed execution");
  }
  if (result.completedAtMs < result.startedAtMs) {
    throw new Error("completedAtMs should be >= startedAtMs");
  }

  console.log("✅ testCompletedAtIsSet passed");
}

// ============================================================================
// TEST 9 — formats_output_correctly
// ============================================================================

async function testFormatsOutputCorrectly() {
  const reaction = makeReaction({ action: "lock_override_channel" });

  const result = await executeVoiceGovernanceReaction(reaction);
  const formatted = formatVoiceGovernanceReactionExecutionResult(result);

  if (!formatted.includes("✅ Voice Governance Reaction Execution")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("execution ID:")) {
    throw new Error("Missing execution ID in formatted output");
  }
  if (!formatted.includes("effect confirmed:")) {
    throw new Error("Missing effect confirmed in formatted output");
  }
  if (!formatted.includes("effect type:")) {
    throw new Error("Missing effect type in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 10 — all_actions_produce_valid_results
// ============================================================================

async function testAllActionsProduceValidResults() {
  const actions: VoiceGovernanceReactionResult["action"][] = [
    "lock_override_channel",
    "increase_cooling",
    "enter_protected_mode",
    "request_human_review",
    "escalate_to_creator",
    "no_action",
  ];

  for (const action of actions) {
    const reaction = makeReaction({ action });
    const result = await executeVoiceGovernanceReaction(reaction);

    if (result.status !== "completed") {
      throw new Error(`Action ${action} should produce completed status`);
    }
    if (result.reactionAction !== action) {
      throw new Error(`reactionAction should match input action ${action}`);
    }
  }

  console.log("✅ testAllActionsProduceValidResults passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Governance Reaction Execution Tests ===\n");

try {
  await testExecutesLockOverrideChannel();
  await testExecutesIncreaseCooling();
  await testExecutesEnterProtectedMode();
  await testExecutesRequestHumanReview();
  await testExecutesEscalateToCreator();
  await testExecutesNoActionWithoutConfirmation();
  await testExecutionIdIsUnique();
  await testCompletedAtIsSet();
  await testFormatsOutputCorrectly();
  await testAllActionsProduceValidResults();

  console.log("\n✅ All voice governance reaction execution tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
