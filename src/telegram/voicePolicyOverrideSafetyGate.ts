/**
 * Voice Policy Override Safety Gate v3.5
 *
 * Takes a policy injection advisory and loop stability state to determine
 * whether an external policy override is safe to apply or should be
 * restricted / blocked to protect system integrity.
 *
 * This layer answers:
 *   - "Is this external override safe to apply given current loop state?"
 *   - "Should we allow, restrict, or block the override?"
 *   - "What is the effective override after safety checks?"
 *
 * This layer does NOT:
 *   - actually apply overrides
 *   - change scheduling
 *   - change execution gate
 *   - change readiness memory
 *   - change cooling policy
 *   - change resume advisory
 *   - mutate runtime config
 *   - launch recheck execution
 *   - use DB / ML / external dependencies
 */

import type { VoiceLoopPolicyInjectionAdvisory } from "./voiceLoopPolicyInjectionAdvisory.js";
import type { VoiceRecheckLoopStabilityAdvisory } from "./voiceRecheckLoopStabilityAdvisory.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoicePolicySafetyDecision =
  | "allow_override"
  | "restrict_override"
  | "block_override";

export interface VoicePolicyOverrideSafetyGateResult {
  generatedAtMs: number;

  safetyDecision: VoicePolicySafetyDecision;

  effectiveOverride:
    | "none"
    | "soft_limited"
    | "hard_limited"
    | "blocked";

  summary: string;
  safetyInstruction: string;

  reasons: string[];
  warnings: string[];
}

export interface EvaluateVoicePolicyOverrideSafetyInput {
  injection: VoiceLoopPolicyInjectionAdvisory;
  stability: VoiceRecheckLoopStabilityAdvisory;
}

// ============================================================================
// Safety rules
// ============================================================================

/**
 * RULE 1 — block_override
 *
 * Triggered by:
 *   - stabilityStatus === "unstable" AND overrideDecision === "hard_override"
 *
 * Cannot allow hard override on unstable loop — would break the system.
 */
function buildBlockOverride(
  input: EvaluateVoicePolicyOverrideSafetyInput,
): VoicePolicyOverrideSafetyGateResult {
  const reasons = [
    "unstable_loop_cannot_accept_hard_override",
    "safety_gate_blocks_potentially_destructive_override",
  ];
  const warnings = [
    "external_override_attempted_on_unstable_loop",
    "system_integrity_takes_priority_over_external_policy",
  ];

  return {
    generatedAtMs: Date.now(),
    safetyDecision: "block_override",
    effectiveOverride: "blocked",
    summary:
      "Policy override is blocked — external hard override cannot be applied to an unstable loop without risking system integrity.",
    safetyInstruction:
      "Do not apply the external override. Stabilize the loop first before accepting external policy changes.",
    reasons,
    warnings,
  };
}

/**
 * RULE 2 — restrict_override (unstable + soft)
 *
 * Triggered by:
 *   - stabilityStatus === "unstable" AND overrideDecision === "soft_override"
 *
 * Only limited soft influence allowed on unstable loop.
 */
function buildRestrictOverrideUnstable(
  input: EvaluateVoicePolicyOverrideSafetyInput,
): VoicePolicyOverrideSafetyGateResult {
  const reasons = [
    "unstable_loop_restricts_external_influence",
    "safety_gate_limits_soft_override_on_unstable_loop",
  ];
  const warnings = [
    "external_soft_override_reduced_on_unstable_loop",
    "internal_stabilization_remains_authoritative",
  ];

  return {
    generatedAtMs: Date.now(),
    safetyDecision: "restrict_override",
    effectiveOverride: "soft_limited",
    summary:
      "Policy override is restricted — only limited soft influence is permitted while the loop remains unstable.",
    safetyInstruction:
      "Apply only a minimal conservative bias from the external policy. Internal stabilization logic remains dominant.",
    reasons,
    warnings,
  };
}

/**
 * RULE 3 — restrict_override (watch + hard)
 *
 * Triggered by:
 *   - stabilityStatus === "watch" AND overrideDecision === "hard_override"
 *
 * Hard override on watch state needs restriction to avoid breaking fragile stability.
 */
function buildRestrictOverrideWatch(
  input: EvaluateVoicePolicyOverrideSafetyInput,
): VoicePolicyOverrideSafetyGateResult {
  const reasons = [
    "watch_state_cannot_accept_full_hard_override",
    "safety_gate_limits_hard_override_on_watch_loop",
  ];
  const warnings = [
    "external_hard_override_reduced_on_watch_loop",
    "fragile_stability_should_not_be_broken_by_override",
  ];

  return {
    generatedAtMs: Date.now(),
    safetyDecision: "restrict_override",
    effectiveOverride: "hard_limited",
    summary:
      "Policy override is restricted — hard external policy is limited on a watch-state loop to avoid breaking fragile stability.",
    safetyInstruction:
      "Apply the external override with reduced force. Monitor loop carefully after applying the limited override.",
    reasons,
    warnings,
  };
}

/**
 * RULE 4 — allow_override (stable)
 *
 * Triggered by:
 *   - stabilityStatus === "stable"
 *
 * System is healthy — external policy can be applied according to its level.
 */
function buildAllowOverride(
  input: EvaluateVoicePolicyOverrideSafetyInput,
): VoicePolicyOverrideSafetyGateResult {
  const effectiveOverride =
    input.injection.overrideDecision === "no_override"
      ? "none"
      : input.injection.overrideDecision === "soft_override"
        ? "soft_limited"
        : "hard_limited";

  const reasons = [
    "stable_loop_can_accept_external_override",
    "safety_gate_allows_policy_injection",
  ];
  const warnings: string[] = [];

  return {
    generatedAtMs: Date.now(),
    safetyDecision: "allow_override",
    effectiveOverride,
    summary:
      "Policy override is allowed — loop is stable and external policy can be applied at the requested level.",
    safetyInstruction:
      "Apply the external policy override as specified. Continue monitoring loop stability after application.",
    reasons,
    warnings,
  };
}

// ============================================================================
// Core safety gate function
// ============================================================================

/**
 * Evaluate policy override safety from injection advisory and stability state.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoicePolicyOverrideSafety(
  input: EvaluateVoicePolicyOverrideSafetyInput,
): VoicePolicyOverrideSafetyGateResult {
  // RULE 1 — unstable + hard → block
  if (
    input.stability.stabilityStatus === "unstable" &&
    input.injection.overrideDecision === "hard_override"
  ) {
    return buildBlockOverride(input);
  }

  // RULE 2 — unstable + soft → restrict
  if (
    input.stability.stabilityStatus === "unstable" &&
    input.injection.overrideDecision === "soft_override"
  ) {
    return buildRestrictOverrideUnstable(input);
  }

  // RULE 3 — watch + hard → restrict
  if (
    input.stability.stabilityStatus === "watch" &&
    input.injection.overrideDecision === "hard_override"
  ) {
    return buildRestrictOverrideWatch(input);
  }

  // RULE 4 — stable → allow (default safe path)
  return buildAllowOverride(input);
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a policy override safety gate result for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoicePolicyOverrideSafetyGateResult(
  result: VoicePolicyOverrideSafetyGateResult,
): string {
  const lines = [
    `🛡️ Voice Policy Override Safety Gate`,
    `• safety decision: ${result.safetyDecision}`,
    `• effective override: ${result.effectiveOverride}`,
    `• summary: ${result.summary}`,
    `• safety instruction: ${result.safetyInstruction}`,
  ];

  if (result.reasons.length > 0) {
    lines.push(`• reasons: ${result.reasons.join(", ")}`);
  }
  if (result.warnings.length > 0) {
    lines.push(`• warnings: ${result.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
