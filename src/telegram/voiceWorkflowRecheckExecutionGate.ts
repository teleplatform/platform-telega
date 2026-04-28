/**
 * Voice Workflow Recheck Execution Gate v2.8
 *
 * Takes a VoiceWorkflowRecheckScheduling and bounded runtime context
 * to determine whether a recheck execution is actually safe to run now.
 *
 * This layer answers:
 *   - "Is it safe to actually run recheck right now?"
 *   - "Should we hold, deny, or allow execution?"
 *   - "What is the reason class for this decision?"
 *
 * This layer does NOT:
 *   - start recheck execution
 *   - change scheduling strategy
 *   - mutate workflow state
 *   - change approval surface
 *   - mutate runtime config
 *   - perform retry / recovery
 *   - add DB / ML / external dependencies
 */

import type { VoiceWorkflowRecheckScheduling } from "./voiceWorkflowRecheckScheduling.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceRecheckExecutionDecision =
  | "allow_recheck"
  | "hold_recheck"
  | "deny_recheck";

export interface VoiceWorkflowRecheckExecutionGateResult {
  generatedAtMs: number;

  decision: VoiceRecheckExecutionDecision;
  allowed: boolean;

  reasonClass:
    | "timing_ok"
    | "insufficient_delta"
    | "still_blocked"
    | "cooldown_active";

  summary: string;
  executionInstruction: string;

  reasons: string[];
  warnings: string[];
}

export interface EvaluateVoiceWorkflowRecheckExecutionInput {
  scheduling: VoiceWorkflowRecheckScheduling;

  nowMs: number;
  lastCheckAtMs: number | null;

  hasMeaningfulNewSignals: boolean;
  isRecoveryStillActive: boolean;
}

// ============================================================================
// Execution gate rules
// ============================================================================

/**
 * RULE 1 — deny_recheck
 *
 * Triggered by any of:
 *   - strategy === "no_recheck"
 *   - isRecoveryStillActive === true AND strategy !== "immediate_retry"
 *
 * The workflow remains blocked or recheck is explicitly disallowed.
 */
function buildDenyRecheck(
  input: EvaluateVoiceWorkflowRecheckExecutionInput,
): VoiceWorkflowRecheckExecutionGateResult {
  const reasons = [
    ...input.scheduling.reasons,
  ];
  const warnings = [
    ...input.scheduling.warnings,
  ];

  if (input.scheduling.strategy === "no_recheck") {
    reasons.push("recheck_strategy_disallows_execution");
  }
  if (input.isRecoveryStillActive && input.scheduling.strategy !== "immediate_retry") {
    reasons.push("recovery_state_blocks_recheck");
  }

  warnings.push("recheck_execution_must_not_start_yet");

  return {
    generatedAtMs: input.nowMs,
    decision: "deny_recheck",
    allowed: false,
    reasonClass: "still_blocked",
    summary:
      "Voice recheck execution is denied because the workflow remains blocked or recheck is not allowed.",
    executionInstruction:
      "Do not run recheck. Wait until the blocked condition or scheduling restriction is cleared.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 2 — hold_recheck (cooldown active)
 *
 * Triggered by:
 *   - nextCheckDelayMs !== null AND lastCheckAtMs !== null
 *   - nowMs - lastCheckAtMs < nextCheckDelayMs
 *
 * The recommended scheduling delay has not elapsed yet.
 */
function buildHoldCooldown(
  input: EvaluateVoiceWorkflowRecheckExecutionInput,
): VoiceWorkflowRecheckExecutionGateResult {
  const reasons = [
    ...input.scheduling.reasons,
    "recheck_cooldown_window_not_elapsed",
  ];
  const warnings = [
    ...input.scheduling.warnings,
    "premature_recheck_should_be_avoided",
  ];

  return {
    generatedAtMs: input.nowMs,
    decision: "hold_recheck",
    allowed: false,
    reasonClass: "cooldown_active",
    summary:
      "Voice recheck execution is on hold because the scheduling cooldown window has not elapsed yet.",
    executionInstruction:
      "Wait until the recommended delay passes before attempting recheck execution.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 3 — hold_recheck (insufficient delta)
 *
 * Triggered by:
 *   - cooldown not applicable (no delay or delay passed)
 *   - hasMeaningfulNewSignals !== true
 *
 * No meaningful new signals available to justify another check.
 */
function buildHoldInsufficientDelta(
  input: EvaluateVoiceWorkflowRecheckExecutionInput,
): VoiceWorkflowRecheckExecutionGateResult {
  const reasons = [
    ...input.scheduling.reasons,
    "meaningful_new_signals_not_present",
  ];
  const warnings = [
    ...input.scheduling.warnings,
    "recheck_without_new_evidence_is_not_useful",
  ];

  return {
    generatedAtMs: input.nowMs,
    decision: "hold_recheck",
    allowed: false,
    reasonClass: "insufficient_delta",
    summary:
      "Voice recheck execution is on hold because there are no meaningful new signals to justify another check yet.",
    executionInstruction:
      "Collect additional runtime evidence before attempting recheck execution.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 4 — allow_recheck
 *
 * Triggered when all of:
 *   - scheduling strategy allows recheck (not "no_recheck")
 *   - recovery is not active OR strategy is "immediate_retry"
 *   - cooldown has elapsed (or no delay configured)
 *   - hasMeaningfulNewSignals === true
 *
 * All conditions are met for safe recheck execution.
 */
function buildAllowRecheck(
  input: EvaluateVoiceWorkflowRecheckExecutionInput,
): VoiceWorkflowRecheckExecutionGateResult {
  const reasons = [
    ...input.scheduling.reasons,
    "recheck_timing_window_is_satisfied",
    "meaningful_new_signals_support_execution",
  ];
  const warnings = [...input.scheduling.warnings];

  return {
    generatedAtMs: input.nowMs,
    decision: "allow_recheck",
    allowed: true,
    reasonClass: "timing_ok",
    summary:
      "Voice recheck execution is allowed because scheduling timing and new evidence conditions are satisfied.",
    executionInstruction:
      "Safe to run the next recheck cycle now.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

// ============================================================================
// Core execution gate function
// ============================================================================

/**
 * Evaluate whether a workflow recheck should actually execute now.
 * Pure function — deterministic, bounded, read-only.
 */
export function evaluateVoiceWorkflowRecheckExecution(
  input: EvaluateVoiceWorkflowRecheckExecutionInput,
): VoiceWorkflowRecheckExecutionGateResult {
  // RULE 1 — deny_recheck
  if (input.scheduling.strategy === "no_recheck") {
    return buildDenyRecheck(input);
  }

  if (
    input.isRecoveryStillActive &&
    input.scheduling.strategy !== "immediate_retry"
  ) {
    return buildDenyRecheck(input);
  }

  // RULE 2 — hold_recheck (cooldown active)
  if (
    input.scheduling.nextCheckDelayMs !== null &&
    input.lastCheckAtMs !== null
  ) {
    const elapsed = input.nowMs - input.lastCheckAtMs;
    if (elapsed < input.scheduling.nextCheckDelayMs) {
      return buildHoldCooldown(input);
    }
  }

  // RULE 3 — hold_recheck (insufficient delta)
  if (!input.hasMeaningfulNewSignals) {
    return buildHoldInsufficientDelta(input);
  }

  // RULE 4 — allow_recheck
  return buildAllowRecheck(input);
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a recheck execution gate result for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceWorkflowRecheckExecutionGateResult(
  result: VoiceWorkflowRecheckExecutionGateResult,
): string {
  const lines = [
    `⏱ Voice Recheck Execution Gate`,
    `• decision: ${result.decision}`,
    `• allowed: ${result.allowed ? "yes" : "no"}`,
    `• reason class: ${result.reasonClass}`,
    `• summary: ${result.summary}`,
    `• execution instruction: ${result.executionInstruction}`,
  ];

  if (result.reasons.length > 0) {
    lines.push(`• reasons: ${result.reasons.join(", ")}`);
  }
  if (result.warnings.length > 0) {
    lines.push(`• warnings: ${result.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
