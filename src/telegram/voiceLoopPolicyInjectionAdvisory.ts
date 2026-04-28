/**
 * Voice Loop Policy Injection Advisory v3.4
 *
 * Takes external policy signals and the current cooling/resume state
 * to determine whether external policy should override, bias, or leave
 * the internal loop regulation unchanged.
 *
 * This layer answers:
 *   - "Is there an external policy signal that should influence the loop?"
 *   - "Should internal policy be overridden, biased, or left alone?"
 *   - "What is the severity and direction of the external influence?"
 *
 * This layer does NOT:
 *   - actually override cooling or resume
 *   - change scheduling
 *   - change execution gate
 *   - change readiness memory
 *   - change stability advisory
 *   - change pressure response
 *   - mutate runtime config
 *   - launch recheck execution
 *   - use DB / ML / external dependencies
 */

import type { VoiceLoopCoolingPolicyAdvisory } from "./voiceLoopCoolingPolicyAdvisory.js";
import type { VoiceLoopRecoveryResumeAdvisory } from "./voiceLoopRecoveryResumeAdvisory.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceLoopExternalPolicySignal =
  | "none"
  | "operator_override_soft"
  | "operator_override_hard"
  | "creator_force_cooling"
  | "creator_force_resume_hold"
  | "experiment_slowdown";

export type VoiceLoopPolicyOverrideDecision =
  | "no_override"
  | "soft_override"
  | "hard_override";

export interface VoiceLoopPolicyInjectionInput {
  externalSignal: VoiceLoopExternalPolicySignal;
  cooling: VoiceLoopCoolingPolicyAdvisory;
  resume: VoiceLoopRecoveryResumeAdvisory;
}

export interface VoiceLoopPolicyInjectionAdvisory {
  generatedAtMs: number;

  overrideDecision: VoiceLoopPolicyOverrideDecision;
  effectiveSignal: VoiceLoopExternalPolicySignal;

  policyDirection:
    | "keep_internal_policy"
    | "bias_toward_cooling"
    | "bias_toward_resume_hold"
    | "bias_toward_slowdown";

  severity: "low" | "medium" | "high";

  summary: string;
  policyInstruction: string;

  reasons: string[];
  warnings: string[];
}

// ============================================================================
// Policy injection rules
// ============================================================================

/**
 * RULE 1 — no_override (none)
 *
 * Triggered by:
 *   - externalSignal === "none"
 *
 * No external policy is active — internal regulation remains authoritative.
 */
function buildNoOverride(
  input: VoiceLoopPolicyInjectionInput,
): VoiceLoopPolicyInjectionAdvisory {
  const reasons = [
    "no_external_policy_signal_present",
  ];
  const warnings: string[] = [];

  return {
    generatedAtMs: Date.now(),
    overrideDecision: "no_override",
    effectiveSignal: "none",
    policyDirection: "keep_internal_policy",
    severity: "low",
    summary:
      "No external policy injection is active. Internal loop regulation remains authoritative.",
    policyInstruction:
      "Continue using the internal advisory chain without external override.",
    reasons,
    warnings,
  };
}

/**
 * RULE 2 — soft_override (soft operator / experiment)
 *
 * Triggered by:
 *   - externalSignal === "operator_override_soft"
 *   - OR externalSignal === "experiment_slowdown"
 *
 * A soft external signal should bias the loop toward conservative pacing.
 */
function buildSoftOverride(
  input: VoiceLoopPolicyInjectionInput,
): VoiceLoopPolicyInjectionAdvisory {
  const reasons = [
    "external_policy_signal_requests_conservative_bias",
  ];
  const warnings = [
    "internal_policy_should_not_be_fully_replaced",
  ];

  return {
    generatedAtMs: Date.now(),
    overrideDecision: "soft_override",
    effectiveSignal: input.externalSignal,
    policyDirection: "bias_toward_slowdown",
    severity: "medium",
    summary:
      "A soft external policy signal is active and should bias the loop toward more conservative pacing.",
    policyInstruction:
      "Respect internal loop logic, but prefer slower progression and avoid aggressive resume behavior.",
    reasons,
    warnings,
  };
}

/**
 * RULE 3 — hard_override (creator_force_cooling)
 *
 * Triggered by:
 *   - externalSignal === "creator_force_cooling"
 *
 * Creator-level signal requires prioritizing cooling over internal regulation.
 */
function buildHardOverrideCooling(
  input: VoiceLoopPolicyInjectionInput,
): VoiceLoopPolicyInjectionAdvisory {
  const reasons = [
    "creator_policy_requires_cooling_dominance",
  ];
  const warnings = [
    "external_policy_has_priority_over_resume_path",
  ];

  return {
    generatedAtMs: Date.now(),
    overrideDecision: "hard_override",
    effectiveSignal: input.externalSignal,
    policyDirection: "bias_toward_cooling",
    severity: "high",
    summary:
      "A creator-level external policy signal requires prioritizing loop cooling over internal self-regulation.",
    policyInstruction:
      "Treat cooling policy as dominant until the external override is removed.",
    reasons,
    warnings,
  };
}

/**
 * RULE 4 — hard_override (creator_force_resume_hold / operator_override_hard)
 *
 * Triggered by:
 *   - externalSignal === "creator_force_resume_hold"
 *   - OR externalSignal === "operator_override_hard"
 *
 * A hard external signal blocks resume regardless of internal readiness.
 */
function buildHardOverrideResumeHold(
  input: VoiceLoopPolicyInjectionInput,
): VoiceLoopPolicyInjectionAdvisory {
  const reasons = [
    "external_policy_blocks_resume_progression",
  ];
  const warnings = [
    "resume_path_must_remain_constrained",
  ];

  return {
    generatedAtMs: Date.now(),
    overrideDecision: "hard_override",
    effectiveSignal: input.externalSignal,
    policyDirection: "bias_toward_resume_hold",
    severity: "high",
    summary:
      "A hard external policy signal requires holding loop resume regardless of internal recovery readiness.",
    policyInstruction:
      "Do not allow full resume while the hard external policy signal remains active.",
    reasons,
    warnings,
  };
}

// ============================================================================
// Core policy injection function
// ============================================================================

/**
 * Evaluate policy injection advisory from external signals and internal state.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceLoopPolicyInjection(
  input: VoiceLoopPolicyInjectionInput,
): VoiceLoopPolicyInjectionAdvisory {
  switch (input.externalSignal) {
    case "none":
      return buildNoOverride(input);

    case "operator_override_soft":
    case "experiment_slowdown":
      return buildSoftOverride(input);

    case "creator_force_cooling":
      return buildHardOverrideCooling(input);

    case "creator_force_resume_hold":
    case "operator_override_hard":
      return buildHardOverrideResumeHold(input);

    default:
      return buildNoOverride(input);
  }
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a policy injection advisory for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceLoopPolicyInjectionAdvisory(
  advisory: VoiceLoopPolicyInjectionAdvisory,
): string {
  const lines = [
    `🧩 Voice Loop Policy Injection`,
    `• override decision: ${advisory.overrideDecision}`,
    `• effective signal: ${advisory.effectiveSignal}`,
    `• policy direction: ${advisory.policyDirection}`,
    `• severity: ${advisory.severity}`,
    `• summary: ${advisory.summary}`,
    `• policy instruction: ${advisory.policyInstruction}`,
  ];

  if (advisory.reasons.length > 0) {
    lines.push(`• reasons: ${advisory.reasons.join(", ")}`);
  }
  if (advisory.warnings.length > 0) {
    lines.push(`• warnings: ${advisory.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
