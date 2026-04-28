/**
 * Voice Recheck Loop Stability Advisory v3.0
 *
 * Takes a VoiceRecheckExecutionReadinessSummary and produces an explainable
 * assessment of whether the recheck loop is stable, needs watching, or is unstable.
 *
 * This layer answers:
 *   - "Is the recheck loop healthy?"
 *   - "Is the loop stalling or overheating?"
 *   - "Does the cycle require intervention?"
 *
 * This layer does NOT:
 *   - change execution gate logic
 *   - alter scheduling strategy
 *   - mutate workflow state
 *   - change readiness memory
 *   - launch recheck execution
 *   - mutate runtime config
 *   - use DB / ML / external dependencies
 */

import type { VoiceRecheckExecutionReadinessSummary } from "./voiceRecheckExecutionReadinessMemory.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceLoopStabilityStatus =
  | "stable"
  | "watch"
  | "unstable";

export interface VoiceRecheckLoopStabilityAdvisory {
  generatedAtMs: number;

  stabilityStatus: VoiceLoopStabilityStatus;
  confidence: "high" | "medium" | "low";

  loopPressure: "low" | "medium" | "high";

  summary: string;
  advisoryInstruction: string;

  reasons: string[];
  warnings: string[];
}

// ============================================================================
// Stability rules
// ============================================================================

/**
 * RULE 1 — unstable
 *
 * Triggered by any of:
 *   - repeatedDenyPattern === true
 *   - repeatedHoldPattern === true
 *   - totalChecks >= 5 && allowCount === 0
 *
 * The loop is showing repeated blocking or stalling behavior.
 */
function buildUnstable(
  summary: VoiceRecheckExecutionReadinessSummary,
): VoiceRecheckLoopStabilityAdvisory {
  const reasons: string[] = [...summary.repeatedDenyPattern ? ["repeated_blocking_pattern_detected"] : []];
  if (summary.repeatedHoldPattern) {
    reasons.push("repeated_stall_pattern_detected");
  }
  if (summary.totalChecks >= 5 && summary.allowCount === 0) {
    reasons.push("loop_progress_without_success_is_absent");
  }

  const warnings = ["loop_instability_requires_intervention"];

  return {
    generatedAtMs: Date.now(),
    stabilityStatus: "unstable",
    confidence: "high",
    loopPressure: "high",
    summary:
      "Voice recheck loop appears unstable due to repeated blocked or stalled execution outcomes.",
    advisoryInstruction:
      "Do not tighten the loop further. Investigate repeated hold/deny behavior before continuing.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: [...warnings],
  };
}

/**
 * RULE 2 — watch
 *
 * Triggered by:
 *   - totalChecks >= 3
 *   - allowCount > 0
 *   - AND (holdCount >= 2 OR denyCount >= 1)
 *
 * The loop shows mild instability — some holds or denies mixed with allows.
 */
function buildWatch(
  summary: VoiceRecheckExecutionReadinessSummary,
): VoiceRecheckLoopStabilityAdvisory {
  const reasons = [
    "mixed_execution_outcomes_detected",
    "loop_should_remain_under_observation",
  ];
  const warnings = ["loop_pressure_is_nonzero"];

  return {
    generatedAtMs: Date.now(),
    stabilityStatus: "watch",
    confidence: "medium",
    loopPressure: "medium",
    summary:
      "Voice recheck loop shows mild instability signals and should remain under observation.",
    advisoryInstruction:
      "Continue monitoring loop behavior and avoid aggressive recheck acceleration.",
    reasons,
    warnings,
  };
}

/**
 * RULE 3 — stable (default)
 *
 * Triggered in all other cases:
 *   - no repeated patterns
 *   - not enough checks to trigger watch
 *   - or clean execution history
 *
 * The loop appears healthy.
 */
function buildStable(
  summary: VoiceRecheckExecutionReadinessSummary,
): VoiceRecheckLoopStabilityAdvisory {
  const reasons = ["execution_memory_indicates_stable_loop"];
  const warnings: string[] = [];

  return {
    generatedAtMs: Date.now(),
    stabilityStatus: "stable",
    confidence: "medium",
    loopPressure: "low",
    summary:
      "Voice recheck loop appears stable based on recent execution readiness memory.",
    advisoryInstruction:
      "Loop behavior is currently healthy. Safe to continue under current bounded scheduling policy.",
    reasons,
    warnings,
  };
}

/**
 * RULE 4 — zero-state (special stable case)
 *
 * Triggered by:
 *   - totalChecks === 0
 *
 * No history yet — provisionally stable with low confidence.
 */
function buildZeroState(): VoiceRecheckLoopStabilityAdvisory {
  const reasons: string[] = [];
  const warnings = ["loop_history_not_yet_available"];

  return {
    generatedAtMs: Date.now(),
    stabilityStatus: "stable",
    confidence: "low",
    loopPressure: "low",
    summary:
      "Voice recheck loop has no history yet; stability is provisionally treated as neutral-stable.",
    advisoryInstruction:
      "Collect initial execution history before drawing strong loop stability conclusions.",
    reasons,
    warnings,
  };
}

// ============================================================================
// Core stability evaluation function
// ============================================================================

/**
 * Evaluate recheck loop stability from a readiness memory summary.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceRecheckLoopStability(
  summary: VoiceRecheckExecutionReadinessSummary,
): VoiceRecheckLoopStabilityAdvisory {
  // RULE 4 — zero-state (check first, before unstable rules)
  if (summary.totalChecks === 0) {
    return buildZeroState();
  }

  // RULE 1 — unstable
  if (
    summary.repeatedDenyPattern ||
    summary.repeatedHoldPattern ||
    (summary.totalChecks >= 5 && summary.allowCount === 0)
  ) {
    return buildUnstable(summary);
  }

  // RULE 2 — watch
  if (
    summary.totalChecks >= 3 &&
    summary.allowCount > 0 &&
    (summary.holdCount >= 2 || summary.denyCount >= 1)
  ) {
    return buildWatch(summary);
  }

  // RULE 3 — stable (default)
  return buildStable(summary);
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a loop stability advisory for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceRecheckLoopStabilityAdvisory(
  advisory: VoiceRecheckLoopStabilityAdvisory,
): string {
  const lines = [
    `🌀 Voice Recheck Loop Stability`,
    `• stability status: ${advisory.stabilityStatus}`,
    `• confidence: ${advisory.confidence}`,
    `• loop pressure: ${advisory.loopPressure}`,
    `• summary: ${advisory.summary}`,
    `• advisory instruction: ${advisory.advisoryInstruction}`,
  ];

  if (advisory.reasons.length > 0) {
    lines.push(`• reasons: ${advisory.reasons.join(", ")}`);
  }
  if (advisory.warnings.length > 0) {
    lines.push(`• warnings: ${advisory.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
