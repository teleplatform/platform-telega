/**
 * Voice Long-Horizon Objective Alignment & Drift Control Layer v7.2
 *
 * Evaluates how well the system's current behavior aligns with its
 * long-term goals, detects alignment drift, and recommends corrections
 * to keep the system on course.
 *
 * This layer answers:
 *   - "Is the system still aligned with its long-term objectives?"
 *   - "Is there drift away from goals over time?"
 *   - "Should we rebalance, shift strategy, or enter safe mode?"
 *
 * This layer does NOT:
 *   - change runtime config
 *   - apply any adaptations
 *   - mutate execution truth
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";
import type { VoiceSystemGoal } from "./voiceGoalModel.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceDriftTrend =
  | "improving"
  | "stable"
  | "degrading";

export type VoiceAlignmentStatus =
  | "aligned"
  | "warning"
  | "misaligned";

export type VoiceAlignmentCorrection =
  | "maintain"
  | "rebalance_goals"
  | "force_strategy_shift"
  | "enter_safe_mode";

export interface VoiceGoalAlignmentScore {
  goalId: string;
  goalType: string;
  alignmentScore: number; // 0–100
}

export interface VoiceObjectiveAlignment {
  alignmentId: string;
  goalAlignmentScores: VoiceGoalAlignmentScore[];
  overallAlignment: number; // 0–100
  driftTrend: VoiceDriftTrend;
  alignmentStatus: VoiceAlignmentStatus;
  correctionRecommendation: VoiceAlignmentCorrection;
  evaluatedAt: number;
}

export interface EvaluateObjectiveAlignmentInput {
  goals: VoiceSystemGoal[];
  previousAlignment?: number; // For trend detection
}

// ============================================================================
// ID generation
// ============================================================================

function generateAlignmentId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `voice_alignment_${ts}_${rand}`;
}

// ============================================================================
// Alignment calculation
// ============================================================================

function calculateGoalAlignmentScore(
  goal: VoiceSystemGoal,
): number {
  // Alignment = how well current score matches goal priority weight
  const priorityWeight = goal.priority / 100;
  const scoreNormalized = goal.currentScore / 100;

  // Alignment is higher when high-priority goals have high scores
  const raw = scoreNormalized * priorityWeight;

  // Bonus for satisfied status
  const statusBonus =
    goal.goalStatus === "satisfied" ? 0.2 :
    goal.goalStatus === "at_risk" ? 0.1 :
      0;

  return Math.min(100, Math.round((raw + statusBonus) * 100));
}

function calculateOverallAlignment(
  goalScores: VoiceGoalAlignmentScore[],
  goals: VoiceSystemGoal[],
): number {
  if (goalScores.length === 0) return 0;

  // Weighted average by goal priority
  let totalWeight = 0;
  let weightedSum = 0;

  for (const score of goalScores) {
    const goal = goals.find((g) => g.goalId === score.goalId);
    const weight = goal?.priority ?? 50;
    weightedSum += score.alignmentScore * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

function classifyDriftTrend(
  current: number,
  previous?: number,
): VoiceDriftTrend {
  if (previous === undefined) return "stable";

  const diff = current - previous;
  if (diff > 5) return "improving";
  if (diff < -5) return "degrading";
  return "stable";
}

function classifyAlignmentStatus(
  overall: number,
): VoiceAlignmentStatus {
  if (overall >= 70) return "aligned";
  if (overall >= 50) return "warning";
  return "misaligned";
}

function recommendCorrection(
  status: VoiceAlignmentStatus,
  overall: number,
): VoiceAlignmentCorrection {
  if (status === "aligned") return "maintain";
  if (overall < 30) return "enter_safe_mode";
  if (overall < 50) return "force_strategy_shift";
  return "rebalance_goals";
}

// ============================================================================
// Core alignment evaluator
// ============================================================================

/**
 * Evaluate long-horizon objective alignment and drift.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceObjectiveAlignment(
  input: EvaluateObjectiveAlignmentInput,
): VoiceObjectiveAlignment {
  const goalScores = input.goals.map((g) => ({
    goalId: g.goalId,
    goalType: g.goalType,
    alignmentScore: calculateGoalAlignmentScore(g),
  }));

  const overall = calculateOverallAlignment(goalScores, input.goals);
  const driftTrend = classifyDriftTrend(overall, input.previousAlignment);
  const status = classifyAlignmentStatus(overall);
  const correction = recommendCorrection(status, overall);

  return {
    alignmentId: generateAlignmentId(),
    goalAlignmentScores: goalScores,
    overallAlignment: overall,
    driftTrend,
    alignmentStatus: status,
    correctionRecommendation: correction,
    evaluatedAt: Date.now(),
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatObjectiveAlignment(
  alignment: VoiceObjectiveAlignment,
): string {
  return [
    `🧭 Voice Objective Alignment`,
    `• alignment ID: ${alignment.alignmentId}`,
    `• overall: ${alignment.overallAlignment}/100`,
    `• status: ${alignment.alignmentStatus}`,
    `• drift trend: ${alignment.driftTrend}`,
    `• correction: ${alignment.correctionRecommendation}`,
    `• per-goal:`,
    ...alignment.goalAlignmentScores.map(
      (s) => `    → ${s.goalType}: ${s.alignmentScore}/100`,
    ),
  ].join("\n");
}
