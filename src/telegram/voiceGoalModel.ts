/**
 * Voice Goal Model & System Objective Layer v7.0
 *
 * Defines and tracks formal system goals (stability, learning, performance,
 * safety, adaptation speed) with priority, target ranges, and status —
 * ensuring all decisions align with active goals.
 *
 * This layer answers:
 *   - "What are the system's current goals and their priorities?"
 *   - "Are goals satisfied, at risk, or violated?"
 *   - "How well is the system performing against each goal?"
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

export type VoiceGoalType =
  | "stability"
  | "learning"
  | "performance"
  | "safety"
  | "adaptation_speed";

export type VoiceGoalStatus =
  | "satisfied"
  | "at_risk"
  | "violated";

export interface VoiceSystemGoal {
  goalId: string;
  goalType: VoiceGoalType;
  priority: number; // 0–100
  targetRange: {
    min?: number;
    max?: number;
  };
  currentScore: number; // 0–100
  goalStatus: VoiceGoalStatus;
  lastEvaluatedAt: number;
}

export interface EvaluateVoiceGoalInput {
  goalType: VoiceGoalType;
  priority?: number;
  targetRange?: { min?: number; max?: number };
  currentScore: number;
  existingGoal?: VoiceSystemGoal;
}

// ============================================================================
// ID generation
// ============================================================================

function generateGoalId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `voice_goal_${ts}_${rand}`;
}

// ============================================================================
// Goal status classification
// ============================================================================

function classifyGoalStatus(
  currentScore: number,
  targetRange?: { min?: number; max?: number },
): VoiceGoalStatus {
  if (!targetRange) {
    // Default thresholds
    if (currentScore >= 70) return "satisfied";
    if (currentScore >= 40) return "at_risk";
    return "violated";
  }

  const min = targetRange.min ?? 0;
  const max = targetRange.max ?? 100;

  if (currentScore >= max * 0.8) return "satisfied";
  if (currentScore >= min) return "at_risk";
  return "violated";
}

// ============================================================================
// Core goal evaluator
// ============================================================================

/**
 * Evaluate or update a system goal based on current performance.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceGoal(
  input: EvaluateVoiceGoalInput,
): VoiceSystemGoal {
  const status = classifyGoalStatus(input.currentScore, input.targetRange);

  return {
    goalId: input.existingGoal?.goalId ?? generateGoalId(),
    goalType: input.goalType,
    priority: input.priority ?? input.existingGoal?.priority ?? 50,
    targetRange: input.targetRange ?? input.existingGoal?.targetRange ?? {},
    currentScore: input.currentScore,
    goalStatus: status,
    lastEvaluatedAt: Date.now(),
  };
}

// ============================================================================
// Goal set builder (convenience)
// ============================================================================

export function buildDefaultGoalSet(
  overrides?: Partial<Record<VoiceGoalType, Partial<EvaluateVoiceGoalInput>>>,
): VoiceSystemGoal[] {
  const defaults: EvaluateVoiceGoalInput[] = [
    { goalType: "stability", priority: 90, currentScore: 70 },
    { goalType: "learning", priority: 60, currentScore: 50 },
    { goalType: "performance", priority: 70, currentScore: 60 },
    { goalType: "safety", priority: 95, currentScore: 80 },
    { goalType: "adaptation_speed", priority: 40, currentScore: 40 },
  ];

  return defaults.map((d) => {
    const override = overrides?.[d.goalType];
    return evaluateVoiceGoal({
      ...d,
      ...override,
      currentScore: override?.currentScore ?? d.currentScore,
      priority: override?.priority ?? d.priority,
    });
  });
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceGoal(
  goal: VoiceSystemGoal,
): string {
  return [
    `🎯 Voice System Goal`,
    `• goal ID: ${goal.goalId}`,
    `• type: ${goal.goalType}`,
    `• priority: ${goal.priority}`,
    `• score: ${goal.currentScore}/100`,
    `• status: ${goal.goalStatus}`,
  ].join("\n");
}

export function formatVoiceGoalSet(
  goals: VoiceSystemGoal[],
): string {
  return [
    `📋 Voice Goal Set`,
    ...goals.map((g) => `  → ${g.goalType}: ${g.currentScore}/100 (${g.goalStatus}) [pri:${g.priority}]`),
  ].join("\n");
}
