import {
  evaluateVoiceGoal,
  buildDefaultGoalSet,
  formatVoiceGoal,
  formatVoiceGoalSet,
  type VoiceSystemGoal,
  type EvaluateVoiceGoalInput,
} from "../../../src/telegram/voiceGoalModel.js";
import {
  detectVoiceGoalConflicts,
  formatGoalConflict,
  type DetectVoiceGoalConflictsInput,
  type VoiceGoalConflict,
} from "../../../src/telegram/voiceGoalConflictDetection.js";
import {
  evaluateVoiceObjectiveAlignment,
  formatObjectiveAlignment,
  type EvaluateObjectiveAlignmentInput,
  type VoiceObjectiveAlignment,
} from "../../../src/telegram/voiceObjectiveAlignment.js";

// ============================================================================
// V7.0 TESTS
// ============================================================================

function testGoalEvaluatedAsSatisfied() {
  const input: EvaluateVoiceGoalInput = {
    goalType: "stability",
    priority: 90,
    currentScore: 85,
  };

  const goal = evaluateVoiceGoal(input);

  if (goal.goalStatus !== "satisfied") {
    throw new Error(`Expected satisfied, got ${goal.goalStatus}`);
  }
  if (!goal.goalId.startsWith("voice_goal_")) {
    throw new Error("Goal ID should start with voice_goal_");
  }

  console.log("✅ testGoalEvaluatedAsSatisfied passed");
}

function testGoalEvaluatedAsAtRisk() {
  const input: EvaluateVoiceGoalInput = {
    goalType: "learning",
    priority: 60,
    currentScore: 55,
  };

  const goal = evaluateVoiceGoal(input);

  if (goal.goalStatus !== "at_risk") {
    throw new Error(`Expected at_risk, got ${goal.goalStatus}`);
  }

  console.log("✅ testGoalEvaluatedAsAtRisk passed");
}

function testGoalEvaluatedAsViolated() {
  const input: EvaluateVoiceGoalInput = {
    goalType: "safety",
    priority: 95,
    currentScore: 25,
  };

  const goal = evaluateVoiceGoal(input);

  if (goal.goalStatus !== "violated") {
    throw new Error(`Expected violated, got ${goal.goalStatus}`);
  }

  console.log("✅ testGoalEvaluatedAsViolated passed");
}

function testDefaultGoalSetHasAllFiveGoals() {
  const goals = buildDefaultGoalSet();

  if (goals.length !== 5) {
    throw new Error(`Expected 5 goals, got ${goals.length}`);
  }

  const types = goals.map((g) => g.goalType);
  const expected = ["stability", "learning", "performance", "safety", "adaptation_speed"];

  for (const exp of expected) {
    if (!types.includes(exp as any)) {
      throw new Error(`Missing goal type: ${exp}`);
    }
  }

  console.log("✅ testDefaultGoalSetHasAllFiveGoals passed");
}

// ============================================================================
// V7.1 TESTS
// ============================================================================

function testDetectsConflictBetweenLearningAndSafety() {
  const goals = buildDefaultGoalSet({
    learning: { currentScore: 30 },
    safety: { currentScore: 35 },
  });

  const input: DetectVoiceGoalConflictsInput = { goals };
  const conflicts = detectVoiceGoalConflicts(input);

  const learningSafetyConflict = conflicts.find(
    (c) =>
      c.involvedGoals.some((gid) => goals.find((g) => g.goalId === gid)?.goalType === "learning") &&
      c.involvedGoals.some((gid) => goals.find((g) => g.goalId === gid)?.goalType === "safety"),
  );

  if (!learningSafetyConflict) {
    throw new Error("Should detect conflict between learning and safety");
  }
  if (learningSafetyConflict.conflictType !== "direct_conflict") {
    throw new Error(`Expected direct_conflict, got ${learningSafetyConflict.conflictType}`);
  }

  console.log("✅ testDetectsConflictBetweenLearningAndSafety passed");
}

function testDetectsConflictBetweenAdaptationSpeedAndStability() {
  const goals = buildDefaultGoalSet({
    adaptation_speed: { currentScore: 20 },
    stability: { currentScore: 25 },
  });

  const conflicts = detectVoiceGoalConflicts({ goals });

  const speedStabilityConflict = conflicts.find(
    (c) =>
      c.involvedGoals.some((gid) => goals.find((g) => g.goalId === gid)?.goalType === "adaptation_speed") &&
      c.involvedGoals.some((gid) => goals.find((g) => g.goalId === gid)?.goalType === "stability"),
  );

  if (!speedStabilityConflict) {
    throw new Error("Should detect conflict between adaptation_speed and stability");
  }

  console.log("✅ testDetectsConflictBetweenAdaptationSpeedAndStability passed");
}

function testSafetyWinsInConflict() {
  const goals = buildDefaultGoalSet({
    learning: { currentScore: 20, priority: 80 },
    safety: { currentScore: 25, priority: 70 },
  });

  const conflicts = detectVoiceGoalConflicts({ goals });

  const conflict = conflicts.find(
    (c) =>
      c.involvedGoals.some((gid) => goals.find((g) => g.goalId === gid)?.goalType === "learning") &&
      c.involvedGoals.some((gid) => goals.find((g) => g.goalId === gid)?.goalType === "safety"),
  );

  if (!conflict) throw new Error("Should have conflict");

  const safetyGoal = goals.find((g) => g.goalType === "safety");
  if (conflict.resolvedGoal !== safetyGoal?.goalId) {
    throw new Error(`Safety should win conflict, got ${conflict.resolvedGoal}`);
  }

  console.log("✅ testSafetyWinsInConflict passed");
}

function testNoConflictWhenAllSatisfied() {
  const goals = buildDefaultGoalSet({
    stability: { currentScore: 90 },
    learning: { currentScore: 85 },
    safety: { currentScore: 95 },
    performance: { currentScore: 80 },
    adaptation_speed: { currentScore: 75 },
  });

  const conflicts = detectVoiceGoalConflicts({ goals });

  // With all satisfied, no conflicts should be detected
  if (conflicts.length !== 0) {
    throw new Error(`Expected no conflicts when all satisfied, got ${conflicts.length}`);
  }

  console.log("✅ testNoConflictWhenAllSatisfied passed");
}

// ============================================================================
// V7.2 TESTS
// ============================================================================

function testAlignmentCalculatedCorrectly() {
  const goals = buildDefaultGoalSet({
    stability: { currentScore: 80 },
    safety: { currentScore: 90 },
  });

  const input: EvaluateObjectiveAlignmentInput = { goals };
  const alignment = evaluateVoiceObjectiveAlignment(input);

  if (alignment.overallAlignment < 0 || alignment.overallAlignment > 100) {
    throw new Error(`Overall alignment should be 0-100, got ${alignment.overallAlignment}`);
  }
  if (alignment.goalAlignmentScores.length !== 5) {
    throw new Error(`Expected 5 goal scores, got ${alignment.goalAlignmentScores.length}`);
  }

  console.log("✅ testAlignmentCalculatedCorrectly passed");
}

function testAlignmentStatusAlignedWhenHigh() {
  const goals = buildDefaultGoalSet({
    stability: { currentScore: 90 },
    learning: { currentScore: 85 },
    safety: { currentScore: 95 },
    performance: { currentScore: 80 },
    adaptation_speed: { currentScore: 75 },
  });

  const alignment = evaluateVoiceObjectiveAlignment({ goals });

  if (alignment.alignmentStatus !== "aligned") {
    throw new Error(`Expected aligned status, got ${alignment.alignmentStatus}`);
  }

  console.log("✅ testAlignmentStatusAlignedWhenHigh passed");
}

function testAlignmentStatusMisalignedWhenLow() {
  const goals = buildDefaultGoalSet({
    stability: { currentScore: 10 },
    learning: { currentScore: 15 },
    safety: { currentScore: 20 },
    performance: { currentScore: 10 },
    adaptation_speed: { currentScore: 5 },
  });

  const alignment = evaluateVoiceObjectiveAlignment({ goals });

  if (alignment.alignmentStatus !== "misaligned") {
    throw new Error(`Expected misaligned status, got ${alignment.alignmentStatus}`);
  }
  if (alignment.correctionRecommendation !== "enter_safe_mode") {
    throw new Error(`Expected enter_safe_mode, got ${alignment.correctionRecommendation}`);
  }

  console.log("✅ testAlignmentStatusMisalignedWhenLow passed");
}

function testDriftTrendDegrading() {
  const goals = buildDefaultGoalSet({
    stability: { currentScore: 40 },
    safety: { currentScore: 45 },
  });

  const alignment = evaluateVoiceObjectiveAlignment({
    goals,
    previousAlignment: 80,
  });

  if (alignment.driftTrend !== "degrading") {
    throw new Error(`Expected degrading drift, got ${alignment.driftTrend}`);
  }

  console.log("✅ testDriftTrendDegrading passed");
}

function testDriftTrendImproving() {
  const goals = buildDefaultGoalSet({
    stability: { currentScore: 80 },
    safety: { currentScore: 85 },
  });

  const alignment = evaluateVoiceObjectiveAlignment({
    goals,
    previousAlignment: 50,
  });

  if (alignment.driftTrend !== "improving") {
    throw new Error(`Expected improving drift, got ${alignment.driftTrend}`);
  }

  console.log("✅ testDriftTrendImproving passed");
}

function testCorrectionRecommendationBasedOnStatus() {
  // Aligned → maintain
  const alignedGoals = buildDefaultGoalSet({
    stability: { currentScore: 90 },
    safety: { currentScore: 95 },
  });
  const aligned = evaluateVoiceObjectiveAlignment({ goals: alignedGoals });
  if (aligned.correctionRecommendation !== "maintain") {
    throw new Error(`Expected maintain for aligned, got ${aligned.correctionRecommendation}`);
  }

  // Misaligned → safe mode
  const misalignedGoals = buildDefaultGoalSet({
    stability: { currentScore: 10 },
    safety: { currentScore: 15 },
  });
  const misaligned = evaluateVoiceObjectiveAlignment({ goals: misalignedGoals });
  if (misaligned.correctionRecommendation !== "enter_safe_mode") {
    throw new Error(`Expected enter_safe_mode, got ${misaligned.correctionRecommendation}`);
  }

  console.log("✅ testCorrectionRecommendationBasedOnStatus passed");
}

function testFormatsOutputCorrectly() {
  const goals = buildDefaultGoalSet();
  const formatted = formatVoiceGoalSet(goals);

  if (!formatted.includes("📋 Voice Goal Set")) {
    throw new Error("Missing goal set header");
  }
  if (!formatted.includes("stability:")) {
    throw new Error("Missing stability goal");
  }

  const alignment = evaluateVoiceObjectiveAlignment({ goals });
  const alignFormatted = formatObjectiveAlignment(alignment);

  if (!alignFormatted.includes("🧭 Voice Objective Alignment")) {
    throw new Error("Missing alignment header");
  }
  if (!alignFormatted.includes("overall:")) {
    throw new Error("Missing overall alignment");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== V7.0–V7.2: Goal Model → Conflict Detection → Objective Alignment Tests ===\n");

try {
  // V7.0
  testGoalEvaluatedAsSatisfied();
  testGoalEvaluatedAsAtRisk();
  testGoalEvaluatedAsViolated();
  testDefaultGoalSetHasAllFiveGoals();

  // V7.1
  testDetectsConflictBetweenLearningAndSafety();
  testDetectsConflictBetweenAdaptationSpeedAndStability();
  testSafetyWinsInConflict();
  testNoConflictWhenAllSatisfied();

  // V7.2
  testAlignmentCalculatedCorrectly();
  testAlignmentStatusAlignedWhenHigh();
  testAlignmentStatusMisalignedWhenLow();
  testDriftTrendDegrading();
  testDriftTrendImproving();
  testCorrectionRecommendationBasedOnStatus();
  testFormatsOutputCorrectly();

  console.log("\n✅ All V7.0–V7.2 tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
