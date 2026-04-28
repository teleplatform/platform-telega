/**
 * Voice Loop Pressure Response Advisory v3.1
 *
 * Takes a VoiceRecheckLoopStabilityAdvisory and produces a concrete
 * response-policy recommendation for how the system should react to loop pressure.
 *
 * This layer answers:
 *   - "What should the system do about current loop pressure?"
 *   - "Should we slow down, freeze, investigate, or keep going?"
 *   - "What is the severity of the required response?"
 *
 * This layer does NOT:
 *   - change scheduling
 *   - change execution gate
 *   - change readiness memory
 *   - change workflow state
 *   - mutate runtime config
 *   - launch recheck execution
 *   - use DB / ML / external dependencies
 */

import type { VoiceRecheckLoopStabilityAdvisory } from "./voiceRecheckLoopStabilityAdvisory.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceLoopPressureResponse =
  | "no_action"
  | "slow_down_loop"
  | "freeze_loop"
  | "investigate_loop";

export interface VoiceLoopPressureResponseAdvisory {
  generatedAtMs: number;

  response: VoiceLoopPressureResponse;

  recommendedAction:
    | "keep_current_strategy"
    | "increase_delay"
    | "temporarily_stop_recheck"
    | "manual_investigation_required";

  severity: "low" | "medium" | "high";

  summary: string;
  responseInstruction: string;

  reasons: string[];
  warnings: string[];
}

// ============================================================================
// Response rules
// ============================================================================

/**
 * RULE 1 — freeze_loop
 *
 * Triggered by:
 *   - stabilityStatus === "unstable"
 *
 * The loop cannot safely continue in its current form.
 */
function buildFreezeLoop(
  stability: VoiceRecheckLoopStabilityAdvisory,
): VoiceLoopPressureResponseAdvisory {
  const reasons = [
    ...stability.reasons,
    "loop_instability_requires_freeze",
    "high_loop_pressure_detected",
  ];
  const warnings = [
    ...stability.warnings,
    "recheck_progression_should_pause",
  ];

  return {
    generatedAtMs: Date.now(),
    response: "freeze_loop",
    recommendedAction: "temporarily_stop_recheck",
    severity: "high",
    summary:
      "Voice loop pressure is too high to continue bounded recheck activity safely.",
    responseInstruction:
      "Freeze recheck progression temporarily and investigate repeated instability before continuing.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 2 — slow_down_loop
 *
 * Triggered by:
 *   - stabilityStatus === "watch"
 *
 * The loop should remain active but with increased delay.
 */
function buildSlowDownLoop(
  stability: VoiceRecheckLoopStabilityAdvisory,
): VoiceLoopPressureResponseAdvisory {
  const reasons = [
    ...stability.reasons,
    "loop_pressure_requires_slowdown",
    "watch_state_supports_conservative_response",
  ];
  const warnings = [
    ...stability.warnings,
    "loop_should_not_be_tightened",
  ];

  return {
    generatedAtMs: Date.now(),
    response: "slow_down_loop",
    recommendedAction: "increase_delay",
    severity: "medium",
    summary:
      "Voice loop pressure is elevated and recheck cadence should be slowed down.",
    responseInstruction:
      "Keep the loop active, but increase delay and avoid aggressive recheck acceleration.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 3 — investigate_loop (low-confidence stable)
 *
 * Triggered by:
 *   - stabilityStatus === "stable" AND confidence === "low"
 *
 * The loop appears stable but history is too weak for a strong assumption.
 */
function buildInvestigateLoop(
  stability: VoiceRecheckLoopStabilityAdvisory,
): VoiceLoopPressureResponseAdvisory {
  const reasons = [
    ...stability.reasons,
    "loop_history_is_insufficient_for_strong_response",
  ];
  const warnings = [
    ...stability.warnings,
    "stability_is_provisional",
  ];

  return {
    generatedAtMs: Date.now(),
    response: "investigate_loop",
    recommendedAction: "manual_investigation_required",
    severity: "medium",
    summary:
      "Voice loop appears provisionally stable, but history is too weak for a strong operational assumption.",
    responseInstruction:
      "Collect more loop history and verify execution behavior before trusting the stability assessment.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 4 — no_action (default stable case)
 *
 * Triggered by:
 *   - stabilityStatus === "stable" AND confidence !== "low"
 *
 * The loop is healthy and no response adjustment is needed.
 */
function buildNoAction(
  stability: VoiceRecheckLoopStabilityAdvisory,
): VoiceLoopPressureResponseAdvisory {
  const reasons = [
    ...stability.reasons,
    "loop_pressure_is_within_safe_bounds",
  ];
  const warnings = [...stability.warnings];

  return {
    generatedAtMs: Date.now(),
    response: "no_action",
    recommendedAction: "keep_current_strategy",
    severity: "low",
    summary:
      "Voice loop pressure is currently low and no response adjustment is needed.",
    responseInstruction:
      "Keep the current bounded scheduling and execution policy unchanged.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

// ============================================================================
// Core response evaluation function
// ============================================================================

/**
 * Evaluate loop pressure response from a stability advisory.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceLoopPressureResponse(
  stability: VoiceRecheckLoopStabilityAdvisory,
): VoiceLoopPressureResponseAdvisory {
  switch (stability.stabilityStatus) {
    case "unstable":
      return buildFreezeLoop(stability);
    case "watch":
      return buildSlowDownLoop(stability);
    case "stable":
      // RULE 3 — low confidence zero-state → investigate
      if (stability.confidence === "low") {
        return buildInvestigateLoop(stability);
      }
      // RULE 4 — stable with sufficient confidence → no_action
      return buildNoAction(stability);
    default:
      return buildNoAction(stability);
  }
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a loop pressure response advisory for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceLoopPressureResponseAdvisory(
  advisory: VoiceLoopPressureResponseAdvisory,
): string {
  const lines = [
    `🧯 Voice Loop Pressure Response`,
    `• response: ${advisory.response}`,
    `• recommended action: ${advisory.recommendedAction}`,
    `• severity: ${advisory.severity}`,
    `• summary: ${advisory.summary}`,
    `• response instruction: ${advisory.responseInstruction}`,
  ];

  if (advisory.reasons.length > 0) {
    lines.push(`• reasons: ${advisory.reasons.join(", ")}`);
  }
  if (advisory.warnings.length > 0) {
    lines.push(`• warnings: ${advisory.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
