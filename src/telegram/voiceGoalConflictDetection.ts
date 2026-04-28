/**
 * Voice Goal Conflict Detection & Prioritization Layer v7.1
 *
 * Detects conflicts between system goals (e.g., learning vs safety,
 * stability vs adaptation speed), resolves them by priority, and
 * ensures no decision proceeds with unresolved goal conflicts.
 *
 * This layer answers:
 *   - "Are any system goals currently in conflict?"
 *   - "Which goal should win when they conflict?"
 *   - "What is the severity and resolution strategy?"
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

export type VoiceGoalConflictType =
  | "direct_conflict"
  | "resource_tradeoff"
  | "temporal_conflict";

export type VoiceGoalConflictResolution =
  | "priority_override"
  | "balance"
  | "defer_lower_goal";

export interface VoiceGoalConflict {
  conflictId: string;
  involvedGoals: string[];
  conflictType: VoiceGoalConflictType;
  severity: number; // 0–100
  resolutionStrategy: VoiceGoalConflictResolution;
  resolvedGoal: string;
  resolvedAt: number;
}

export interface DetectVoiceGoalConflictsInput {
  goals: VoiceSystemGoal[];
}

// ============================================================================
// Known conflict pairs
// ============================================================================

const KNOWN_CONFLICT_PAIRS: Array<{
  a: string;
  b: string;
  type: VoiceGoalConflictType;
  winner: string;
}> = [
  { a: "learning", b: "safety", type: "direct_conflict", winner: "safety" },
  { a: "adaptation_speed", b: "stability", type: "direct_conflict", winner: "stability" },
  { a: "performance", b: "safety", type: "resource_tradeoff", winner: "safety" },
  { a: "learning", b: "stability", type: "temporal_conflict", winner: "stability" },
  { a: "adaptation_speed", b: "safety", type: "direct_conflict", winner: "safety" },
  { a: "performance", b: "stability", type: "resource_tradeoff", winner: "stability" },
];

// ============================================================================
// ID generation
// ============================================================================

function generateConflictId(): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `voice_conflict_${ts}_${rand}`;
}

// ============================================================================
// Conflict detection logic
// ============================================================================

/**
 * Detect goal conflicts based on status divergence and priority inversion.
 * Pure function — deterministic, bounded, read-only.
 */
export function detectVoiceGoalConflicts(
  input: DetectVoiceGoalConflictsInput,
): VoiceGoalConflict[] {
  const conflicts: VoiceGoalConflict[] = [];
  const { goals } = input;

  if (goals.length < 2) return conflicts;

  for (const pair of KNOWN_CONFLICT_PAIRS) {
    const goalA = goals.find((g) => g.goalType === pair.a);
    const goalB = goals.find((g) => g.goalType === pair.b);

    if (!goalA || !goalB) continue;

    // Conflict exists when one is violated/at_risk while other is satisfied
    const aStruggling = goalA.goalStatus !== "satisfied";
    const bStruggling = goalB.goalStatus !== "satisfied";

    // If both struggling → direct conflict
    // If one struggling, other satisfied → potential conflict
    if (aStruggling || bStruggling) {
      const severity = calculateConflictSeverity(goalA, goalB);
      const winner = resolveConflictByPriority(goalA, goalB, pair.winner);

      const resolution: VoiceGoalConflictResolution =
        severity >= 70 ? "priority_override" :
        severity >= 40 ? "balance" :
          "defer_lower_goal";

      conflicts.push({
        conflictId: generateConflictId(),
        involvedGoals: [goalA.goalId, goalB.goalId],
        conflictType: pair.type,
        severity,
        resolutionStrategy: resolution,
        resolvedGoal: winner,
        resolvedAt: Date.now(),
      });
    }
  }

  return conflicts;
}

function calculateConflictSeverity(
  a: VoiceSystemGoal,
  b: VoiceSystemGoal,
): number {
  // Higher severity when both are struggling and priorities are close
  const scoreDiff = Math.abs(a.currentScore - b.currentScore);
  const priorityDiff = Math.abs(a.priority - b.priority);

  let severity = 0;

  // Base: both at risk or violated
  if (a.goalStatus === "violated" && b.goalStatus === "violated") {
    severity += 60;
  } else if (a.goalStatus === "violated" || b.goalStatus === "violated") {
    severity += 40;
  } else if (a.goalStatus === "at_risk" && b.goalStatus === "at_risk") {
    severity += 30;
  } else {
    severity += 10;
  }

  // Closer priorities → higher conflict severity (harder to decide)
  severity += Math.max(0, 30 - priorityDiff);

  return Math.min(100, Math.max(0, severity));
}

function resolveConflictByPriority(
  a: VoiceSystemGoal,
  b: VoiceSystemGoal,
  defaultWinner: string,
): string {
  // Safety always wins in direct conflict
  if (a.goalType === "safety") return a.goalId;
  if (b.goalType === "safety") return b.goalId;

  // Otherwise use priority
  if (a.priority > b.priority) return a.goalId;
  if (b.priority > a.priority) return b.goalId;

  // Tie → default winner
  if (a.goalType === defaultWinner) return a.goalId;
  return b.goalId;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatGoalConflict(
  conflict: VoiceGoalConflict,
): string {
  return [
    `⚔️ Voice Goal Conflict`,
    `• conflict ID: ${conflict.conflictId}`,
    `• type: ${conflict.conflictType}`,
    `• severity: ${conflict.severity}/100`,
    `• resolution: ${conflict.resolutionStrategy}`,
    `• resolved goal: ${conflict.resolvedGoal}`,
  ].join("\n");
}
