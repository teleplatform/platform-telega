/**
 * Voice Loop Recovery Resume Advisory v3.3
 *
 * Takes a VoiceLoopCoolingPolicyAdvisory and bounded new-signal context
 * to determine whether and how the loop should resume after cooling.
 *
 * This layer answers:
 *   - "Is the loop ready to resume after cooling?"
 *   - "Should we resume fully, cautiously, or hold position?"
 *   - "What is the readiness level for resuming?"
 *
 * This layer does NOT:
 *   - change scheduling
 *   - change execution gate
 *   - change readiness memory
 *   - change stability advisory
 *   - change pressure response
 *   - change cooling policy
 *   - start timers or schedules
 *   - mutate runtime config
 *   - use DB / ML / external dependencies
 */

import type { VoiceLoopCoolingPolicyAdvisory } from "./voiceLoopCoolingPolicyAdvisory.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceLoopResumeDecision =
  | "resume_normal"
  | "resume_cautiously"
  | "remain_in_cooling";

export interface VoiceLoopRecoveryResumeAdvisory {
  generatedAtMs: number;

  resumeDecision: VoiceLoopResumeDecision;

  resumeMode:
    | "full_resume"
    | "gradual_resume"
    | "hold_position";

  readinessLevel: "low" | "medium" | "high";

  summary: string;
  resumeInstruction: string;

  reasons: string[];
  warnings: string[];
}

export interface EvaluateVoiceLoopRecoveryResumeInput {
  cooling: VoiceLoopCoolingPolicyAdvisory;
  hasNewStabilitySignals: boolean;
}

// ============================================================================
// Resume rules
// ============================================================================

/**
 * RULE 1 — remain_in_cooling (freeze)
 *
 * Triggered by:
 *   - coolingMode === "freeze_until_manual_review"
 *
 * The loop must remain frozen until manual review clears the condition.
 */
function buildRemainInCoolingFreeze(
  input: EvaluateVoiceLoopRecoveryResumeInput,
): VoiceLoopRecoveryResumeAdvisory {
  const reasons = [
    ...input.cooling.reasons,
    "cooling_policy_controls_resume",
    "freeze_requires_manual_clearance_before_resume",
  ];
  const warnings = [
    ...input.cooling.warnings,
    "resume_must_not_occur_without_manual_review",
  ];

  return {
    generatedAtMs: Date.now(),
    resumeDecision: "remain_in_cooling",
    resumeMode: "hold_position",
    readinessLevel: "low",
    summary:
      "Loop remains frozen until manual review clears the cooling condition.",
    resumeInstruction:
      "Do not resume loop. Wait for explicit manual clearance.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 2 — remain_in_cooling (hard cooldown, no new signals)
 *
 * Triggered by:
 *   - coolingMode === "hard_cooldown" AND hasNewStabilitySignals === false
 *
 * Still in cooldown with no new evidence — hold position.
 */
function buildRemainInCoolingHard(
  input: EvaluateVoiceLoopRecoveryResumeInput,
): VoiceLoopRecoveryResumeAdvisory {
  const reasons = [
    ...input.cooling.reasons,
    "cooling_policy_controls_resume",
    "no_new_stability_signals_to_justify_resume",
  ];
  const warnings = [
    ...input.cooling.warnings,
    "resume_requires_signal_confirmation",
  ];

  return {
    generatedAtMs: Date.now(),
    resumeDecision: "remain_in_cooling",
    resumeMode: "hold_position",
    readinessLevel: "low",
    summary:
      "Loop remains in hard cooldown — no new stability signals available to justify resuming yet.",
    resumeInstruction:
      "Hold position until new stability signals are collected before attempting resume.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 3 — resume_cautiously (hard cooldown, with new signals)
 *
 * Triggered by:
 *   - coolingMode === "hard_cooldown" AND hasNewStabilitySignals === true
 *
 * New signals present — cautious gradual resume possible.
 */
function buildCautiousResumeFromHard(
  input: EvaluateVoiceLoopRecoveryResumeInput,
): VoiceLoopRecoveryResumeAdvisory {
  const reasons = [
    ...input.cooling.reasons,
    "cooling_policy_controls_resume",
    "new_stability_signals_support_cautious_resume",
  ];
  const warnings = [
    ...input.cooling.warnings,
    "resume_should_be_gradual_and_monitored",
  ];

  return {
    generatedAtMs: Date.now(),
    resumeDecision: "resume_cautiously",
    resumeMode: "gradual_resume",
    readinessLevel: "medium",
    summary:
      "Loop can resume cautiously — new stability signals justify a gradual return to activity.",
    resumeInstruction:
      "Resume loop gradually with increased monitoring and avoid aggressive cadence initially.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 4 — resume_cautiously (soft cooldown)
 *
 * Triggered by:
 *   - coolingMode === "soft_cooldown"
 *
 * Soft cooldown completed — cautious gradual resume.
 */
function buildCautiousResumeFromSoft(
  input: EvaluateVoiceLoopRecoveryResumeInput,
): VoiceLoopRecoveryResumeAdvisory {
  const reasons = [
    ...input.cooling.reasons,
    "cooling_policy_controls_resume",
    "soft_cooldown_completed_allowing_gradual_resume",
  ];
  const warnings = [
    ...input.cooling.warnings,
    "resume_should_be_gradual_and_monitored",
  ];

  return {
    generatedAtMs: Date.now(),
    resumeDecision: "resume_cautiously",
    resumeMode: "gradual_resume",
    readinessLevel: "medium",
    summary:
      "Loop can resume cautiously after soft cooldown — gradual return to normal activity recommended.",
    resumeInstruction:
      "Resume loop gradually and continue monitoring for stability signals.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 5 — resume_normal (no cooling)
 *
 * Triggered by:
 *   - coolingMode === "no_cooling"
 *
 * Loop is healthy — full resume.
 */
function buildNormalResume(
  input: EvaluateVoiceLoopRecoveryResumeInput,
): VoiceLoopRecoveryResumeAdvisory {
  const reasons = [
    ...input.cooling.reasons,
    "cooling_policy_controls_resume",
    "no_cooling_required_allowing_full_resume",
  ];
  const warnings = [...input.cooling.warnings];

  return {
    generatedAtMs: Date.now(),
    resumeDecision: "resume_normal",
    resumeMode: "full_resume",
    readinessLevel: "high",
    summary:
      "Loop is ready for normal resume — no cooling restrictions are active.",
    resumeInstruction:
      "Resume loop at normal cadence under current bounded scheduling policy.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

// ============================================================================
// Core resume evaluation function
// ============================================================================

/**
 * Evaluate loop recovery resume from a cooling policy advisory.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceLoopRecoveryResume(
  input: EvaluateVoiceLoopRecoveryResumeInput,
): VoiceLoopRecoveryResumeAdvisory {
  switch (input.cooling.coolingMode) {
    case "freeze_until_manual_review":
      return buildRemainInCoolingFreeze(input);

    case "hard_cooldown":
      if (input.hasNewStabilitySignals) {
        return buildCautiousResumeFromHard(input);
      }
      return buildRemainInCoolingHard(input);

    case "soft_cooldown":
      return buildCautiousResumeFromSoft(input);

    case "no_cooling":
    default:
      return buildNormalResume(input);
  }
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a loop recovery resume advisory for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceLoopRecoveryResumeAdvisory(
  advisory: VoiceLoopRecoveryResumeAdvisory,
): string {
  const lines = [
    `🔁 Voice Loop Resume Advisory`,
    `• decision: ${advisory.resumeDecision}`,
    `• mode: ${advisory.resumeMode}`,
    `• readiness: ${advisory.readinessLevel}`,
    `• summary: ${advisory.summary}`,
    `• instruction: ${advisory.resumeInstruction}`,
  ];

  if (advisory.reasons.length > 0) {
    lines.push(`• reasons: ${advisory.reasons.join(", ")}`);
  }
  if (advisory.warnings.length > 0) {
    lines.push(`• warnings: ${advisory.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
