/**
 * Voice Adaptation Budget & Evolution Pressure Control Layer v5.6
 *
 * Tracks adaptation pressure across active rollouts, high-risk changes,
 * and drifting/unstable states — enforcing a budget that limits how
 * much the system can evolve at any given time.
 *
 * This layer answers:
 *   - "How much adaptation pressure is the system under right now?"
 *   - "Is the evolution budget healthy, warming, constrained, or frozen?"
 *   - "Should we allow or block new adaptations based on pressure?"
 *
 * This layer does NOT:
 *   - change runtime config
 *   - apply any adaptations
 *   - mutate execution truth
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceAdaptationBudgetStatus =
  | "healthy"
  | "warming"
  | "constrained"
  | "frozen";

export interface VoiceAdaptationBudgetState {
  budgetId: string;
  windowMs: number;
  allowedRollouts: number;
  activeRollouts: number;
  allowedHighRiskWeight: number;
  consumedHighRiskWeight: number;
  pressureScore: number; // 0–100
  budgetStatus: VoiceAdaptationBudgetStatus;
  evaluatedAt: number;
}

export interface EvaluateAdaptationBudgetInput {
  windowMs?: number;
  allowedRollouts?: number;
  allowedHighRiskWeight?: number;

  // Current state
  activeRolloutCount: number;
  highRiskRolloutCount: number;
  driftingChangeCount: number;
  unstableChangeCount: number;
}

// ============================================================================
// Budget thresholds
// ============================================================================

export const BUDGET_THRESHOLDS = {
  healthyMax: 39,
  warmingMin: 40,
  warmingMax: 59,
  constrainedMin: 60,
  constrainedMax: 79,
  frozenMin: 80,
} as const;

// ============================================================================
// ID generation
// ============================================================================

function generateBudgetId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `voice_budget_${ts}_${rand}`;
}

// ============================================================================
// Pressure score calculation
// ============================================================================

function calculatePressureScore(
  input: EvaluateAdaptationBudgetInput,
): number {
  const {
    activeRolloutCount,
    highRiskRolloutCount,
    driftingChangeCount,
    unstableChangeCount,
  } = input;

  const score =
    activeRolloutCount * 20 +
    highRiskRolloutCount * 25 +
    driftingChangeCount * 20 +
    unstableChangeCount * 35;

  return Math.min(100, Math.max(0, score));
}

function classifyBudgetStatus(
  pressureScore: number,
): VoiceAdaptationBudgetStatus {
  if (pressureScore <= BUDGET_THRESHOLDS.healthyMax) return "healthy";
  if (pressureScore <= BUDGET_THRESHOLDS.warmingMax) return "warming";
  if (pressureScore <= BUDGET_THRESHOLDS.constrainedMax) return "constrained";
  return "frozen";
}

// ============================================================================
// Core budget evaluation
// ============================================================================

/**
 * Evaluate the current adaptation budget and pressure state.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceAdaptationBudget(
  input: EvaluateAdaptationBudgetInput,
): VoiceAdaptationBudgetState {
  const pressureScore = calculatePressureScore(input);
  const budgetStatus = classifyBudgetStatus(pressureScore);

  return {
    budgetId: generateBudgetId(),
    windowMs: input.windowMs ?? 3600_000, // 1 hour default
    allowedRollouts: input.allowedRollouts ?? 5,
    activeRollouts: input.activeRolloutCount,
    allowedHighRiskWeight: input.allowedHighRiskWeight ?? 2,
    consumedHighRiskWeight: input.highRiskRolloutCount,
    pressureScore,
    budgetStatus,
    evaluatedAt: Date.now(),
  };
}

// ============================================================================
// Budget check helper
// ============================================================================

export function canAcceptNewAdaptation(
  budget: VoiceAdaptationBudgetState,
  newAdaptationRisk: "low" | "medium" | "high" | "critical",
): boolean {
  switch (budget.budgetStatus) {
    case "healthy":
      return budget.activeRollouts < budget.allowedRollouts;
    case "warming":
      return newAdaptationRisk === "low" || newAdaptationRisk === "medium";
    case "constrained":
      return newAdaptationRisk === "low";
    case "frozen":
      return false;
  }
}

// ============================================================================
// Formatter
// ============================================================================

export function formatAdaptationBudget(
  budget: VoiceAdaptationBudgetState,
): string {
  return [
    `💰 Voice Adaptation Budget`,
    `• budget ID: ${budget.budgetId}`,
    `• status: ${budget.budgetStatus}`,
    `• pressure score: ${budget.pressureScore}/100`,
    `• active rollouts: ${budget.activeRollouts}/${budget.allowedRollouts}`,
    `• high risk weight: ${budget.consumedHighRiskWeight}/${budget.allowedHighRiskWeight}`,
    `• window: ${(budget.windowMs / 1000 / 60).toFixed(0)}min`,
  ].join("\n");
}
