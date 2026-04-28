/**
 * Voice Workflow Recheck Scheduling Advisory Layer v2.7
 *
 * Takes a VoicePostDecisionWorkflowState and produces a policy-level
 * recheck scheduling strategy for the control plane.
 *
 * This layer answers:
 *   - "When should the system recheck this case?"
 *   - "How urgent is the next check?"
 *   - "What scheduling policy should govern re-evaluation?"
 *
 * This layer does NOT:
 *   - start timers or schedules
 *   - perform retry / recovery
 *   - mutate runtime config
 *   - change workflow state
 *   - trigger automation
 */

import type { VoicePostDecisionWorkflowState } from "./voicePostDecisionWorkflowState.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceRecheckStrategy =
  | "immediate_retry"
  | "short_interval"
  | "medium_interval"
  | "long_interval"
  | "no_recheck";

export interface VoiceWorkflowRecheckScheduling {
  generatedAtMs: number;

  strategy: VoiceRecheckStrategy;

  nextCheckDelayMs: number | null;

  urgency: "high" | "medium" | "low" | "none";

  summary: string;
  schedulingInstruction: string;

  reasons: string[];
  warnings: string[];
}

// ============================================================================
// Scheduling rules
// ============================================================================

/**
 * RULE 1 — immediate_retry
 *
 * Triggered by:
 *   - workflowState === "risk_block_recovery"
 *
 * Recovery loop should be fast — recheck quickly after stabilization attempt.
 */
function buildImmediateRetry(
  workflow: VoicePostDecisionWorkflowState,
): VoiceWorkflowRecheckScheduling {
  const reasons = [
    ...workflow.reasons,
    "risk_block_requires_fast_recovery_loop",
    "immediate_retry_recommended",
  ];
  const warnings = [
    ...workflow.warnings,
    "recovery_should_be_time_bounded",
  ];

  return {
    generatedAtMs: Date.now(),
    strategy: "immediate_retry",
    nextCheckDelayMs: 5_000,
    urgency: "high",
    summary:
      "Voice case requires immediate recheck after recovery attempt — risk-blocked state demands fast response.",
    schedulingInstruction:
      "Recheck after 5 seconds to allow rapid recovery while avoiding busy-loop.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 2 — short_interval
 *
 * Triggered by:
 *   - workflowState === "observation_hold"
 *
 * Observation needs more evidence soon — short recheck window.
 */
function buildShortInterval(
  workflow: VoicePostDecisionWorkflowState,
): VoiceWorkflowRecheckScheduling {
  const reasons = [
    ...workflow.reasons,
    "observation_hold_requires_frequent_recheck",
    "evidence_collection_window_open",
  ];
  const warnings = [
    ...workflow.warnings,
    "observation_timeout_should_not_exceed_short_window",
  ];

  return {
    generatedAtMs: Date.now(),
    strategy: "short_interval",
    nextCheckDelayMs: 30_000,
    urgency: "medium",
    summary:
      "Voice case is on observation hold — short-interval recheck recommended to collect stable evidence.",
    schedulingInstruction:
      "Recheck after 30 seconds to balance evidence collection with operator load.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 3 — medium_interval
 *
 * Triggered by:
 *   - workflowState === "awaiting_human_approval"
 *
 * Awaiting human action — no rush, but should remain visible.
 */
function buildMediumInterval(
  workflow: VoicePostDecisionWorkflowState,
): VoiceWorkflowRecheckScheduling {
  const reasons = [
    ...workflow.reasons,
    "awaiting_human_allows_relaxed_recheck",
    "visibility_maintained_without_pressure",
  ];
  const warnings = [
    ...workflow.warnings,
    "stale_approval_request_should_be_monitored",
  ];

  return {
    generatedAtMs: Date.now(),
    strategy: "medium_interval",
    nextCheckDelayMs: 120_000,
    urgency: "low",
    summary:
      "Voice case is awaiting human approval — medium-interval recheck sufficient for visibility.",
    schedulingInstruction:
      "Recheck after 2 minutes to maintain awareness without pressuring operator.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 4 — long_interval (passive monitoring)
 *
 * Triggered by:
 *   - workflowState === "passive_monitoring"
 *
 * Passive monitoring — minimal recheck, long interval.
 */
function buildLongInterval(
  workflow: VoicePostDecisionWorkflowState,
): VoiceWorkflowRecheckScheduling {
  const reasons = [
    ...workflow.reasons,
    "passive_monitoring_allows_slow_recheck",
    "low_touch_recheck_policy",
  ];
  const warnings = [
    ...workflow.warnings,
    "workflow_fallback_active",
  ];

  return {
    generatedAtMs: Date.now(),
    strategy: "long_interval",
    nextCheckDelayMs: 300_000,
    urgency: "none",
    summary:
      "Voice case is in passive monitoring — long-interval recheck with minimal urgency.",
    schedulingInstruction:
      "Recheck after 5 minutes — passive monitoring only, no active intervention expected.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 5 — no_recheck (safe fallback for unrecognized state)
 *
 * Triggered by:
 *   - nextCheckRecommended === false AND workflowState not recognized
 *
 * System should not attempt recheck — unknown state requires caution.
 */
function buildNoRecheck(
  workflow: VoicePostDecisionWorkflowState,
): VoiceWorkflowRecheckScheduling {
  const reasons = [
    ...workflow.reasons,
    "unrecognized_workflow_state",
    "recheck_not_recommended",
  ];
  const warnings = [
    ...workflow.warnings,
    "workflow_state_should_be_investigated",
    "no_automated_recheck_until_state_is_known",
  ];

  return {
    generatedAtMs: Date.now(),
    strategy: "no_recheck",
    nextCheckDelayMs: null,
    urgency: "none",
    summary:
      "Voice case is in unrecognized workflow state — no automated recheck until state is clarified.",
    schedulingInstruction:
      "Do not recheck automatically. Investigate workflow state before enabling recheck policy.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

// ============================================================================
// Core scheduling function
// ============================================================================

/**
 * Determine the workflow recheck scheduling advisory from a workflow state.
 * Pure function — deterministic, bounded, read-only.
 */
export function determineVoiceWorkflowRecheckScheduling(
  workflow: VoicePostDecisionWorkflowState,
): VoiceWorkflowRecheckScheduling {
  switch (workflow.workflowState) {
    case "risk_block_recovery":
      return buildImmediateRetry(workflow);
    case "observation_hold":
      return buildShortInterval(workflow);
    case "awaiting_human_approval":
      return buildMediumInterval(workflow);
    case "passive_monitoring":
      // If nextCheckRecommended is false, use no_recheck instead
      if (!workflow.nextCheckRecommended) {
        return buildNoRecheck(workflow);
      }
      return buildLongInterval(workflow);
    default:
      return buildNoRecheck(workflow);
  }
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a workflow recheck scheduling advisory for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoiceWorkflowRecheckScheduling(
  scheduling: VoiceWorkflowRecheckScheduling,
): string {
  const delayDisplay =
    scheduling.nextCheckDelayMs !== null
      ? `${(scheduling.nextCheckDelayMs / 1000).toFixed(0)}s`
      : "N/A";

  const lines = [
    `⏱ Voice Workflow Recheck Scheduling`,
    `• strategy: ${scheduling.strategy}`,
    `• next check delay: ${delayDisplay}`,
    `• urgency: ${scheduling.urgency}`,
    `• summary: ${scheduling.summary}`,
    `• scheduling instruction: ${scheduling.schedulingInstruction}`,
  ];

  if (scheduling.reasons.length > 0) {
    lines.push(`• reasons: ${scheduling.reasons.join(", ")}`);
  }
  if (scheduling.warnings.length > 0) {
    lines.push(`• warnings: ${scheduling.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
