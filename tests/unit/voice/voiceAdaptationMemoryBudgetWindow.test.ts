import {
  updateVoiceAdaptationMemory,
  checkAdaptationMemory,
  formatAdaptationMemory,
  type UpdateAdaptationMemoryInput,
  type VoiceAdaptationMemoryRecord,
  type VoiceHistoricalOutcome,
} from "../../../src/telegram/voiceLongHorizonAdaptationMemory.js";
import {
  evaluateVoiceAdaptationBudget,
  canAcceptNewAdaptation,
  formatAdaptationBudget,
  type EvaluateAdaptationBudgetInput,
  type VoiceAdaptationBudgetState,
} from "../../../src/telegram/voiceAdaptationBudgetPressure.js";
import {
  evaluateVoiceEvolutionWindow,
  canLaunchAdaptationInWindow,
  formatEvolutionWindowDecision,
  type EvaluateEvolutionWindowInput,
} from "../../../src/telegram/voiceEvolutionWindowDecision.js";

// ============================================================================
// V5.5 TESTS
// ============================================================================

function testMemoryClassifiesAsHistoricallyEffective() {
  const outcomes: VoiceHistoricalOutcome[] = [
    { lineageId: "l1", outcome: "success", stability: "stable", observedAt: 1000 },
    { lineageId: "l2", outcome: "success", stability: "stable", observedAt: 2000 },
    { lineageId: "l3", outcome: "success", stability: "stable", observedAt: 3000 },
  ];

  const existingMemory: VoiceAdaptationMemoryRecord = {
    memoryId: "mem_test",
    patternKey: "threshold_tuning",
    domain: "policy_threshold",
    historicalOutcomes: outcomes,
    memoryClassification: "historically_effective",
    confidenceScore: 90,
    recommendation: "prefer",
    lastUpdatedAt: 3000,
  };

  const input: UpdateAdaptationMemoryInput = {
    patternKey: "threshold_tuning",
    domain: "policy_threshold",
    lineageId: "l4",
    outcome: "success",
    stability: "stable",
    existingMemory,
  };

  const memory = updateVoiceAdaptationMemory(input);

  if (memory.memoryClassification !== "historically_effective") {
    throw new Error(`Expected historically_effective, got ${memory.memoryClassification}`);
  }
  if (memory.recommendation !== "prefer") {
    throw new Error(`Expected prefer recommendation, got ${memory.recommendation}`);
  }
  if (memory.historicalOutcomes.length !== 4) {
    throw new Error(`Expected 4 outcomes, got ${memory.historicalOutcomes.length}`);
  }

  console.log("✅ testMemoryClassifiesAsHistoricallyEffective passed");
}

function testMemoryClassifiesAsHighRiskRecurrent() {
  const outcomes: VoiceHistoricalOutcome[] = [
    { lineageId: "l1", outcome: "regression", stability: "unstable", observedAt: 1000 },
    { lineageId: "l2", outcome: "rolled_back", stability: "unstable", observedAt: 2000 },
    { lineageId: "l3", outcome: "regression", stability: "unstable", observedAt: 3000 },
  ];

  const existingMemory: VoiceAdaptationMemoryRecord = {
    memoryId: "mem_risk",
    patternKey: "policy_change",
    domain: "reaction_strategy",
    historicalOutcomes: outcomes,
    memoryClassification: "high_risk_recurrent",
    confidenceScore: 80,
    recommendation: "require_creator_only",
    lastUpdatedAt: 3000,
  };

  const input: UpdateAdaptationMemoryInput = {
    patternKey: "policy_change",
    domain: "reaction_strategy",
    lineageId: "l4",
    outcome: "rolled_back",
    stability: "unstable",
    existingMemory,
  };

  const memory = updateVoiceAdaptationMemory(input);

  if (memory.memoryClassification !== "high_risk_recurrent") {
    throw new Error(`Expected high_risk_recurrent, got ${memory.memoryClassification}`);
  }
  if (memory.recommendation !== "require_creator_only") {
    throw new Error(`Expected require_creator_only, got ${memory.recommendation}`);
  }

  console.log("✅ testMemoryClassifiesAsHighRiskRecurrent passed");
}

function testMemoryClassifiesAsHistoricallyIneffective() {
  const outcomes: VoiceHistoricalOutcome[] = [
    { lineageId: "l1", outcome: "no_effect", stability: "stable", observedAt: 1000 },
    { lineageId: "l2", outcome: "no_effect", stability: "stable", observedAt: 2000 },
    { lineageId: "l3", outcome: "no_effect", stability: "stable", observedAt: 3000 },
    { lineageId: "l4", outcome: "success", stability: "stable", observedAt: 4000 },
  ];

  const input: UpdateAdaptationMemoryInput = {
    patternKey: "reaction_change",
    domain: "reaction_strategy",
    lineageId: "l5",
    outcome: "no_effect",
    stability: "stable",
  };

  // Build up outcomes
  let memory: VoiceAdaptationMemoryRecord | undefined;
  for (const o of outcomes) {
    memory = updateVoiceAdaptationMemory({
      patternKey: "reaction_change",
      domain: "reaction_strategy",
      lineageId: o.lineageId,
      outcome: o.outcome,
      stability: o.stability,
      existingMemory: memory,
    });
  }

  // Add one more no_effect
  memory = updateVoiceAdaptationMemory({
    patternKey: "reaction_change",
    domain: "reaction_strategy",
    lineageId: "l5",
    outcome: "no_effect",
    stability: "stable",
    existingMemory: memory,
  });

  if (memory.memoryClassification !== "historically_ineffective") {
    throw new Error(`Expected historically_ineffective, got ${memory.memoryClassification}`);
  }
  if (memory.recommendation !== "avoid") {
    throw new Error(`Expected avoid recommendation, got ${memory.recommendation}`);
  }

  console.log("✅ testMemoryClassifiesAsHistoricallyIneffective passed");
}

function testMemoryLookupReturnsCorrectRecommendation() {
  const memory: VoiceAdaptationMemoryRecord = {
    memoryId: "mem_lookup",
    patternKey: "cooling_adjust",
    domain: "cooling_logic",
    historicalOutcomes: [
      { lineageId: "l1", outcome: "success", stability: "stable", observedAt: 1000 },
    ],
    memoryClassification: "historically_effective",
    confidenceScore: 70,
    recommendation: "prefer",
    lastUpdatedAt: 1000,
  };

  const lookup = checkAdaptationMemory("cooling_adjust", memory);

  if (!lookup.found) {
    throw new Error("Should find existing memory");
  }
  if (lookup.recommendation !== "prefer") {
    throw new Error(`Expected prefer, got ${lookup.recommendation}`);
  }

  // Test missing memory
  const missingLookup = checkAdaptationMemory("unknown_pattern");
  if (missingLookup.found) {
    throw new Error("Should not find missing memory");
  }
  if (missingLookup.recommendation !== "allow_with_review") {
    throw new Error(`Expected allow_with_review for missing, got ${missingLookup.recommendation}`);
  }

  console.log("✅ testMemoryLookupReturnsCorrectRecommendation passed");
}

// ============================================================================
// V5.6 TESTS
// ============================================================================

function testBudgetHealthyWithLowPressure() {
  const input: EvaluateAdaptationBudgetInput = {
    activeRolloutCount: 1,
    highRiskRolloutCount: 0,
    driftingChangeCount: 0,
    unstableChangeCount: 0,
  };

  const budget = evaluateVoiceAdaptationBudget(input);

  if (budget.budgetStatus !== "healthy") {
    throw new Error(`Expected healthy budget, got ${budget.budgetStatus}`);
  }
  if (budget.pressureScore > 39) {
    throw new Error(`Expected pressure ≤39 for healthy, got ${budget.pressureScore}`);
  }

  console.log("✅ testBudgetHealthyWithLowPressure passed");
}

function testBudgetWarmingWithModeratePressure() {
  const input: EvaluateAdaptationBudgetInput = {
    activeRolloutCount: 2,
    highRiskRolloutCount: 0,
    driftingChangeCount: 0,
    unstableChangeCount: 0,
  };

  const budget = evaluateVoiceAdaptationBudget(input);

  if (budget.budgetStatus !== "warming") {
    throw new Error(`Expected warming budget, got ${budget.budgetStatus}`);
  }
  if (budget.pressureScore < 40 || budget.pressureScore > 59) {
    throw new Error(`Expected pressure 40-59 for warming, got ${budget.pressureScore}`);
  }

  console.log("✅ testBudgetWarmingWithModeratePressure passed");
}

function testBudgetFrozenWithCriticalPressure() {
  const input: EvaluateAdaptationBudgetInput = {
    activeRolloutCount: 3,
    highRiskRolloutCount: 2,
    driftingChangeCount: 2,
    unstableChangeCount: 2,
  };

  const budget = evaluateVoiceAdaptationBudget(input);

  if (budget.budgetStatus !== "frozen") {
    throw new Error(`Expected frozen budget, got ${budget.budgetStatus}`);
  }
  if (budget.pressureScore < 80) {
    throw new Error(`Expected pressure ≥80 for frozen, got ${budget.pressureScore}`);
  }

  console.log("✅ testBudgetFrozenWithCriticalPressure passed");
}

function testCanAcceptNewAdaptationRespectsBudget() {
  const healthyBudget: VoiceAdaptationBudgetState = {
    budgetId: "b1",
    windowMs: 3600_000,
    allowedRollouts: 5,
    activeRollouts: 2,
    allowedHighRiskWeight: 2,
    consumedHighRiskWeight: 0,
    pressureScore: 30,
    budgetStatus: "healthy",
    evaluatedAt: Date.now(),
  };

  const frozenBudget: VoiceAdaptationBudgetState = {
    budgetId: "b2",
    windowMs: 3600_000,
    allowedRollouts: 5,
    activeRollouts: 5,
    allowedHighRiskWeight: 2,
    consumedHighRiskWeight: 2,
    pressureScore: 95,
    budgetStatus: "frozen",
    evaluatedAt: Date.now(),
  };

  if (!canAcceptNewAdaptation(healthyBudget, "medium")) {
    throw new Error("Healthy budget should accept medium risk adaptation");
  }
  if (canAcceptNewAdaptation(frozenBudget, "low")) {
    throw new Error("Frozen budget should NOT accept any adaptation");
  }

  console.log("✅ testCanAcceptNewAdaptationRespectsBudget passed");
}

// ============================================================================
// V5.7 TESTS
// ============================================================================

function testWindowOpenWhenHealthyStableLowReview() {
  const input: EvaluateEvolutionWindowInput = {
    budgetStatus: "healthy",
    stabilityContext: "stable",
    reviewLoad: "low",
  };

  const decision = evaluateVoiceEvolutionWindow(input);

  if (decision.evolutionWindowStatus !== "open") {
    throw new Error(`Expected open window, got ${decision.evolutionWindowStatus}`);
  }

  console.log("✅ testWindowOpenWhenHealthyStableLowReview passed");
}

function testWindowRestrictedWhenWarming() {
  const input: EvaluateEvolutionWindowInput = {
    budgetStatus: "warming",
    stabilityContext: "stable",
    reviewLoad: "low",
  };

  const decision = evaluateVoiceEvolutionWindow(input);

  if (decision.evolutionWindowStatus !== "restricted") {
    throw new Error(`Expected restricted for warming, got ${decision.evolutionWindowStatus}`);
  }

  console.log("✅ testWindowRestrictedWhenWarming passed");
}

function testWindowFrozenWhenUnstable() {
  const input: EvaluateEvolutionWindowInput = {
    budgetStatus: "healthy",
    stabilityContext: "unstable",
    reviewLoad: "low",
  };

  const decision = evaluateVoiceEvolutionWindow(input);

  if (decision.evolutionWindowStatus !== "frozen") {
    throw new Error(`Expected frozen for unstable, got ${decision.evolutionWindowStatus}`);
  }

  console.log("✅ testWindowFrozenWhenUnstable passed");
}

function testWindowFrozenWhenBudgetFrozen() {
  const input: EvaluateEvolutionWindowInput = {
    budgetStatus: "frozen",
    stabilityContext: "stable",
    reviewLoad: "low",
  };

  const decision = evaluateVoiceEvolutionWindow(input);

  if (decision.evolutionWindowStatus !== "frozen") {
    throw new Error(`Expected frozen for frozen budget, got ${decision.evolutionWindowStatus}`);
  }

  console.log("✅ testWindowFrozenWhenBudgetFrozen passed");
}

function testCanLaunchAdaptationInWindow() {
  const openWindow = evaluateVoiceEvolutionWindow({
    budgetStatus: "healthy",
    stabilityContext: "stable",
    reviewLoad: "low",
  });

  const frozenWindow = evaluateVoiceEvolutionWindow({
    budgetStatus: "frozen",
    stabilityContext: "stable",
    reviewLoad: "low",
  });

  if (!canLaunchAdaptationInWindow(openWindow, "low")) {
    throw new Error("Open window should allow low risk adaptation");
  }
  if (canLaunchAdaptationInWindow(frozenWindow, "low")) {
    throw new Error("Frozen window should NOT allow any adaptation");
  }

  console.log("✅ testCanLaunchAdaptationInWindow passed");
}

function testRestrictedWindowAllowsOnlyLowRisk() {
  const restrictedWindow = evaluateVoiceEvolutionWindow({
    budgetStatus: "warming",
    stabilityContext: "stable",
    reviewLoad: "medium",
  });

  if (canLaunchAdaptationInWindow(restrictedWindow, "high")) {
    throw new Error("Restricted window should NOT allow high risk");
  }
  if (!canLaunchAdaptationInWindow(restrictedWindow, "low")) {
    throw new Error("Restricted window SHOULD allow low risk");
  }

  console.log("✅ testRestrictedWindowAllowsOnlyLowRisk passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== V5.5–V5.7: Memory → Budget → Evolution Window Tests ===\n");

try {
  // V5.5
  testMemoryClassifiesAsHistoricallyEffective();
  testMemoryClassifiesAsHighRiskRecurrent();
  testMemoryClassifiesAsHistoricallyIneffective();
  testMemoryLookupReturnsCorrectRecommendation();

  // V5.6
  testBudgetHealthyWithLowPressure();
  testBudgetWarmingWithModeratePressure();
  testBudgetFrozenWithCriticalPressure();
  testCanAcceptNewAdaptationRespectsBudget();

  // V5.7
  testWindowOpenWhenHealthyStableLowReview();
  testWindowRestrictedWhenWarming();
  testWindowFrozenWhenUnstable();
  testWindowFrozenWhenBudgetFrozen();
  testCanLaunchAdaptationInWindow();
  testRestrictedWindowAllowsOnlyLowRisk();

  console.log("\n✅ All V5.5–V5.7 tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
