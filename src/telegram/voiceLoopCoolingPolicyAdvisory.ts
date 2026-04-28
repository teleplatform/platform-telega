/**
 * Voice Loop Cooling Policy Advisory v3.2
 *
 * Takes a VoiceLoopPressureResponseAdvisory and produces a concrete
 * cooling-policy recommendation for how the system should cool down the loop.
 *
 * This layer answers:
 *   - "How aggressively should the loop be cooled down?"
 *   - "What cooling window is recommended?"
 *   - "What strictness level should the cooling policy have?"
 *
 * This layer does NOT:
 *   - change scheduling
 *   - change execution gate
 *   - change readiness memory
 *   - change stability advisory
 *   - change pressure response advisory
 *   - change workflow state
 *   - start timers or schedules
 *   - mutate runtime config
 *   - use DB / ML / external dependencies
 */

import type { VoiceLoopPressureResponseAdvisory } from "./voiceLoopPressureResponseAdvisory.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceLoopCoolingMode =
  | "no_cooling"
  | "soft_cooldown"
  | "hard_cooldown"
  | "freeze_until_manual_review";

export interface VoiceLoopCoolingPolicyAdvisory {
  generatedAtMs: number;

  coolingMode: VoiceLoopCoolingMode;
  coolingWindowMs: number | null;

  strictness: "low" | "medium" | "high";

  summary: string;
  coolingInstruction: string;

  reasons: string[];
  warnings: string[];
}

// ============================================================================
// Cooling policy rules
// ============================================================================

/**
 * RULE 1 — freeze_until_manual_review
 *
 * Triggered by:
 *   - response.response === "freeze_loop"
 *
 * The loop requires a hard freeze until manual review clears the condition.
 */
function buildFreezeUntilManualReview(
  response: VoiceLoopPressureResponseAdvisory,
): VoiceLoopCoolingPolicyAdvisory {
  const reasons = [
    ...response.reasons,
    "pressure_response_requires_full_freeze",
    "manual_review_gate_required_before_resume",
  ];
  const warnings = [
    ...response.warnings,
    "loop_resume_must_be_blocked_until_review",
  ];

  return {
    generatedAtMs: Date.now(),
    coolingMode: "freeze_until_manual_review",
    coolingWindowMs: null,
    strictness: "high",
    summary:
      "Voice loop requires a hard freeze policy until manual review clears the pressure condition.",
    coolingInstruction:
      "Do not resume bounded loop activity until a manual investigation path confirms it is safe.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 2 — hard_cooldown
 *
 * Triggered by:
 *   - response.response === "slow_down_loop"
 *
 * The loop needs a material cooldown window before further activity.
 */
function buildHardCooldown(
  response: VoiceLoopPressureResponseAdvisory,
): VoiceLoopCoolingPolicyAdvisory {
  const reasons = [
    ...response.reasons,
    "pressure_response_requires_hard_cooldown",
    "loop_cadence_must_be_reduced",
  ];
  const warnings = [
    ...response.warnings,
    "aggressive_recheck_should_be_avoided",
  ];

  return {
    generatedAtMs: Date.now(),
    coolingMode: "hard_cooldown",
    coolingWindowMs: 300_000,
    strictness: "high",
    summary:
      "Voice loop pressure requires a hard cooldown window before further bounded recheck activity.",
    coolingInstruction:
      "Increase the interval materially and avoid tightening loop cadence until pressure decreases.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 3 — soft_cooldown
 *
 * Triggered by:
 *   - response.response === "investigate_loop"
 *
 * The loop should enter a soft cooldown while additional evidence is collected.
 */
function buildSoftCooldown(
  response: VoiceLoopPressureResponseAdvisory,
): VoiceLoopCoolingPolicyAdvisory {
  const reasons = [
    ...response.reasons,
    "provisional_stability_requires_soft_cooling",
  ];
  const warnings = [
    ...response.warnings,
    "loop_history_is_not_strong_enough_yet",
  ];

  return {
    generatedAtMs: Date.now(),
    coolingMode: "soft_cooldown",
    coolingWindowMs: 120_000,
    strictness: "medium",
    summary:
      "Voice loop should enter a soft cooldown while additional evidence is collected.",
    coolingInstruction:
      "Pause rapid loop progression temporarily and gather more evidence before trusting the current response.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 4 — no_cooling (default)
 *
 * Triggered by:
 *   - response.response === "no_action"
 *
 * The loop pressure is within safe bounds and no cooling is required.
 */
function buildNoCooling(
  response: VoiceLoopPressureResponseAdvisory,
): VoiceLoopCoolingPolicyAdvisory {
  const reasons = [
    ...response.reasons,
    "current_loop_pressure_does_not_require_cooling",
  ];
  const warnings = [...response.warnings];

  return {
    generatedAtMs: Date.now(),
    coolingMode: "no_cooling",
    coolingWindowMs: null,
    strictness: "low",
    summary:
      "Voice loop pressure is within safe bounds and no additional cooling policy is required.",
    coolingInstruction:
      "Keep the current bounded loop policy unchanged.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

// ============================================================================
// Core cooling policy evaluation function
// ============================================================================

/**
 * Evaluate loop cooling policy from a pressure response advisory.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceLoopCoolingPolicy(
  response: VoiceLoopPressureResponseAdvisory,
): VoiceLoopCoolingPolicyAdvisory {
  switch (response.response) {
    case "freeze_loop":
      return buildFreezeUntilManualReview(response);
    case "slow_down_loop":
      return buildHardCooldown(response);
    case "investigate_loop":
      return buildSoftCooldown(response);
    case "no_action":
    default:
      return buildNoCooling(response);
  }
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a loop cooling policy advisory for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceLoopCoolingPolicyAdvisory(
  advisory: VoiceLoopCoolingPolicyAdvisory,
): string {
  const windowDisplay =
    advisory.coolingWindowMs !== null
      ? `${(advisory.coolingWindowMs / 1000).toFixed(0)}s`
      : "N/A";

  const lines = [
    `❄️ Voice Loop Cooling Policy`,
    `• cooling mode: ${advisory.coolingMode}`,
    `• cooling window ms: ${windowDisplay}`,
    `• strictness: ${advisory.strictness}`,
    `• summary: ${advisory.summary}`,
    `• cooling instruction: ${advisory.coolingInstruction}`,
  ];

  if (advisory.reasons.length > 0) {
    lines.push(`• reasons: ${advisory.reasons.join(", ")}`);
  }
  if (advisory.warnings.length > 0) {
    lines.push(`• warnings: ${advisory.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
