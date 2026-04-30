import {
  evaluateVoiceGovernanceReaction,
  formatVoiceGovernanceReactionResult,
  type VoiceGovernanceReactionResult,
} from "../../../src/telegram/voiceGovernanceReactionLayer.js";
import type { VoiceGovernanceTraceEvidence } from "../../../src/telegram/voiceGovernanceTraceEvidence.js";
import { VOICE_GOVERNANCE_SOURCE_LAYERS } from "../../../src/telegram/voiceGovernanceTraceEvidence.js";

// ============================================================================
// helpers
// ============================================================================

function makeEvidence(
  overrides: Partial<VoiceGovernanceTraceEvidence>,
): VoiceGovernanceTraceEvidence {
  return {
    evidenceId: overrides.evidenceId ?? "voice_trace_test",
    traceId: overrides.traceId ?? "trace_test",
    createdAtMs: overrides.createdAtMs ?? Date.now(),
    finalDecisionSummary: overrides.finalDecisionSummary ?? "Loop is stable.",
    explanationSteps: overrides.explanationSteps ?? ["Step 1: stable"],
    keyDrivers: overrides.keyDrivers ?? ["stable loop"],
    riskLevel: overrides.riskLevel ?? "low",
    explanationText: overrides.explanationText ?? "The voice loop is stable.",
    evidenceType: overrides.evidenceType ?? "voice_governance_trace",
    sourceLayers: overrides.sourceLayers ?? VOICE_GOVERNANCE_SOURCE_LAYERS,
    checksum: overrides.checksum ?? "abc123",
  };
}

// ============================================================================
// TEST 1 — locks_override_channel_on_blocked_override
// ============================================================================

function testLocksOverrideChannelOnBlockedOverride() {
  const evidence = makeEvidence({
    riskLevel: "high",
    keyDrivers: ["external hard_override attempt", "safety gate blocked external override"],
  });

  const reaction = evaluateVoiceGovernanceReaction(evidence);

  if (reaction.action !== "lock_override_channel") {
    throw new Error(`Expected lock_override_channel, got ${reaction.action}`);
  }
  if (reaction.severity !== "high") {
    throw new Error(`Expected high severity, got ${reaction.severity}`);
  }
  if (!reaction.triggeredBy.includes("override_blocked")) {
    throw new Error("Should include override_blocked trigger");
  }
  if (!reaction.triggeredBy.includes("safety_gate")) {
    throw new Error("Should include safety_gate trigger");
  }

  console.log("✅ testLocksOverrideChannelOnBlockedOverride passed");
}

// ============================================================================
// TEST 2 — enters_protected_mode_on_high_risk_instability
// ============================================================================

function testEntersProtectedModeOnHighRiskInstability() {
  const evidence = makeEvidence({
    riskLevel: "high",
    keyDrivers: ["loop instability", "freeze response"],
  });

  const reaction = evaluateVoiceGovernanceReaction(evidence);

  if (reaction.action !== "enter_protected_mode") {
    throw new Error(`Expected enter_protected_mode, got ${reaction.action}`);
  }
  if (reaction.severity !== "high") {
    throw new Error(`Expected high severity, got ${reaction.severity}`);
  }

  console.log("✅ testEntersProtectedModeOnHighRiskInstability passed");
}

// ============================================================================
// TEST 3 — increases_cooling_on_instability
// ============================================================================

function testIncreasesCoolingOnInstability() {
  const evidence = makeEvidence({
    riskLevel: "medium",
    keyDrivers: ["loop instability"],
  });

  const reaction = evaluateVoiceGovernanceReaction(evidence);

  if (reaction.action !== "increase_cooling") {
    throw new Error(`Expected increase_cooling, got ${reaction.action}`);
  }
  if (reaction.severity !== "high") {
    throw new Error(`Expected high severity for cooling increase, got ${reaction.severity}`);
  }

  console.log("✅ testIncreasesCoolingOnInstability passed");
}

// ============================================================================
// TEST 4 — increases_cooling_on_freeze
// ============================================================================

function testIncreasesCoolingOnFreeze() {
  const evidence = makeEvidence({
    riskLevel: "low",
    keyDrivers: ["freeze response applied"],
  });

  const reaction = evaluateVoiceGovernanceReaction(evidence);

  if (reaction.action !== "increase_cooling") {
    throw new Error(`Expected increase_cooling for freeze, got ${reaction.action}`);
  }

  console.log("✅ testIncreasesCoolingOnFreeze passed");
}

// ============================================================================
// TEST 5 — escalates_to_creator_on_medium_risk_with_external_policy
// ============================================================================

function testEscalatesToCreatorOnMediumRiskWithExternalPolicy() {
  const evidence = makeEvidence({
    riskLevel: "medium",
    keyDrivers: ["external policy influence"],
  });

  const reaction = evaluateVoiceGovernanceReaction(evidence);

  if (reaction.action !== "escalate_to_creator") {
    throw new Error(`Expected escalate_to_creator, got ${reaction.action}`);
  }
  if (reaction.severity !== "medium") {
    throw new Error(`Expected medium severity, got ${reaction.severity}`);
  }

  console.log("✅ testEscalatesToCreatorOnMediumRiskWithExternalPolicy passed");
}

// ============================================================================
// TEST 6 — requests_human_review_on_medium_risk
// ============================================================================

function testRequestsHumanReviewOnMediumRisk() {
  const evidence = makeEvidence({
    riskLevel: "medium",
    keyDrivers: ["controlled pressure", "cooling active"],
  });

  const reaction = evaluateVoiceGovernanceReaction(evidence);

  if (reaction.action !== "request_human_review") {
    throw new Error(`Expected request_human_review, got ${reaction.action}`);
  }
  if (reaction.severity !== "medium") {
    throw new Error(`Expected medium severity, got ${reaction.severity}`);
  }

  console.log("✅ testRequestsHumanReviewOnMediumRisk passed");
}

// ============================================================================
// TEST 7 — no_action_on_low_risk
// ============================================================================

function testNoActionOnLowRisk() {
  const evidence = makeEvidence({
    riskLevel: "low",
    keyDrivers: ["stable loop"],
  });

  const reaction = evaluateVoiceGovernanceReaction(evidence);

  if (reaction.action !== "no_action") {
    throw new Error(`Expected no_action, got ${reaction.action}`);
  }
  if (reaction.severity !== "low") {
    throw new Error(`Expected low severity, got ${reaction.severity}`);
  }
  if (reaction.triggeredBy.length !== 0) {
    throw new Error("No triggers expected for no_action");
  }

  console.log("✅ testNoActionOnLowRisk passed");
}

// ============================================================================
// TEST 8 — sets_action_correctly_for_all_cases
// ============================================================================

function testSetsActionCorrectlyForAllCases() {
  // High + override blocked → lock
  const lockEvidence = makeEvidence({
    riskLevel: "high",
    keyDrivers: ["override blocked by safety"],
  });
  const lockReaction = evaluateVoiceGovernanceReaction(lockEvidence);
  if (lockReaction.action !== "lock_override_channel") {
    throw new Error(`Expected lock_override_channel, got ${lockReaction.action}`);
  }

  // High + instability → protected
  const protectedEvidence = makeEvidence({
    riskLevel: "high",
    keyDrivers: ["system instability detected"],
  });
  const protectedReaction = evaluateVoiceGovernanceReaction(protectedEvidence);
  if (protectedReaction.action !== "enter_protected_mode") {
    throw new Error(`Expected enter_protected_mode, got ${protectedReaction.action}`);
  }

  // Medium + no external → human review
  const reviewEvidence = makeEvidence({
    riskLevel: "medium",
    keyDrivers: ["pressure building"],
  });
  const reviewReaction = evaluateVoiceGovernanceReaction(reviewEvidence);
  if (reviewReaction.action !== "request_human_review") {
    throw new Error(`Expected request_human_review, got ${reviewReaction.action}`);
  }

  // Low → no action
  const noActionEvidence = makeEvidence({ riskLevel: "low" });
  const noActionReaction = evaluateVoiceGovernanceReaction(noActionEvidence);
  if (noActionReaction.action !== "no_action") {
    throw new Error(`Expected no_action, got ${noActionReaction.action}`);
  }

  console.log("✅ testSetsActionCorrectlyForAllCases passed");
}

// ============================================================================
// TEST 9 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const evidence = makeEvidence({
    riskLevel: "high",
    keyDrivers: ["override blocked"],
  });
  const reaction = evaluateVoiceGovernanceReaction(evidence);
  const formatted = formatVoiceGovernanceReactionResult(reaction);

  if (!formatted.includes("⚡ Voice Governance Reaction")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("action:")) {
    throw new Error("Missing action in formatted output");
  }
  if (!formatted.includes("severity:")) {
    throw new Error("Missing severity in formatted output");
  }
  if (!formatted.includes("reason:")) {
    throw new Error("Missing reason in formatted output");
  }
  if (!formatted.includes("summary:")) {
    throw new Error("Missing summary in formatted output");
  }
  if (!formatted.includes("reaction instruction:")) {
    throw new Error("Missing reaction instruction in formatted output");
  }
  if (!formatted.includes("triggered by:")) {
    throw new Error("Missing triggered by in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 10 — reason_is_meaningful
// ============================================================================

function testReasonIsMeaningful() {
  const evidence = makeEvidence({
    riskLevel: "high",
    keyDrivers: ["override blocked"],
  });
  const reaction = evaluateVoiceGovernanceReaction(evidence);

  if (reaction.reason.length < 20) {
    throw new Error("Reason should be meaningful and descriptive");
  }
  if (reaction.summary.length < 20) {
    throw new Error("Summary should be meaningful and descriptive");
  }
  if (reaction.reactionInstruction.length < 20) {
    throw new Error("Reaction instruction should be meaningful");
  }

  console.log("✅ testReasonIsMeaningful passed");
}

// ============================================================================
// TEST 11 — triggered_by_includes_relevant_drivers
// ============================================================================

function testTriggeredByIncludesRelevantDrivers() {
  const evidence = makeEvidence({
    riskLevel: "high",
    keyDrivers: ["external override blocked by safety gate"],
  });
  const reaction = evaluateVoiceGovernanceReaction(evidence);

  if (reaction.triggeredBy.length === 0) {
    throw new Error("Reaction should include triggers");
  }
  if (!reaction.triggeredBy.includes("override_blocked")) {
    throw new Error("Trigger should include override_blocked");
  }
  if (!reaction.triggeredBy.includes("safety_gate")) {
    throw new Error("Trigger should include safety_gate");
  }

  console.log("✅ testTriggeredByIncludesRelevantDrivers passed");
}

// ============================================================================
// TEST 12 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  const evidence = makeEvidence({
    riskLevel: "medium",
    keyDrivers: ["external policy pressure"],
  });

  const r1 = evaluateVoiceGovernanceReaction(evidence);
  const r2 = evaluateVoiceGovernanceReaction(evidence);

  // Strip decidedAtMs for comparison
  const s1 = { ...r1, decidedAtMs: 0 };
  const s2 = { ...r2, decidedAtMs: 0 };

  if (JSON.stringify(s1) !== JSON.stringify(s2)) {
    throw new Error("Reaction result should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Governance Reaction Layer Tests ===\n");

try {
  testLocksOverrideChannelOnBlockedOverride();
  testEntersProtectedModeOnHighRiskInstability();
  testIncreasesCoolingOnInstability();
  testIncreasesCoolingOnFreeze();
  testEscalatesToCreatorOnMediumRiskWithExternalPolicy();
  testRequestsHumanReviewOnMediumRisk();
  testNoActionOnLowRisk();
  testSetsActionCorrectlyForAllCases();
  testFormatsOutputCorrectly();
  testReasonIsMeaningful();
  testTriggeredByIncludesRelevantDrivers();
  testReturnsDeterministicOutput();

  console.log("\n✅ All voice governance reaction layer tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
