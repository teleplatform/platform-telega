/**
 * Voice Post-Decision Workflow State Layer v2.6
 *
 * Takes a VoiceHumanApprovalDecisionSurface and produces a stable
 * workflow-state continuation decision for the control plane.
 *
 * This layer answers:
 *   - "Which workflow state should this case now live in?"
 *   - "Is the next check recommended and in what mode?"
 *   - "Is this a terminal state?"
 *
 * This layer does NOT:
 *   - change the approval decision
 *   - alter routing decisions
 *   - modify operator priority
 *   - change readiness state
 *   - mutate runtime config
 *   - perform auto-approval
 *   - perform auto-recovery
 *   - add DB / ML / external dependencies
 */

import type { VoiceHumanApprovalDecisionSurface } from "./voiceHumanApprovalDecisionSurface.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceWorkflowState =
  | "awaiting_human_approval"
  | "observation_hold"
  | "risk_block_recovery"
  | "passive_monitoring";

export interface VoicePostDecisionWorkflowState {
  generatedAtMs: number;

  workflowState: VoiceWorkflowState;
  terminal: boolean;

  nextCheckRecommended: boolean;
  nextCheckMode: "none" | "observe_again" | "recover_then_recheck" | "await_human_action";

  summary: string;
  workflowInstruction: string;

  reasons: string[];
  warnings: string[];
}

// ============================================================================
// Workflow state rules
// ============================================================================

/**
 * RULE 1 — awaiting_human_approval
 *
 * Triggered by:
 *   - surface.decision === "approval_open"
 *
 * The case is stable and safe, awaiting explicit human action.
 */
function buildAwaitingHumanApproval(
  surface: VoiceHumanApprovalDecisionSurface,
): VoicePostDecisionWorkflowState {
  const reasons = [
    ...surface.reasons,
    "approval_surface_is_open",
    "workflow_waits_for_human_action",
  ];
  const warnings = [...surface.warnings];

  return {
    generatedAtMs: Date.now(),
    workflowState: "awaiting_human_approval",
    terminal: false,
    nextCheckRecommended: true,
    nextCheckMode: "await_human_action",
    summary:
      "Voice case is awaiting human approval action in a stable trust-aware state.",
    workflowInstruction:
      "Hold current state and wait for human approval action or explicit operator decision.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 2 — observation_hold
 *
 * Triggered by:
 *   - surface.decision === "approval_deferred"
 *
 * The case remains under observation, pending stronger evidence.
 */
function buildObservationHold(
  surface: VoiceHumanApprovalDecisionSurface,
): VoicePostDecisionWorkflowState {
  const reasons = [
    ...surface.reasons,
    "approval_surface_is_deferred",
    "workflow_continues_observation",
  ];
  const warnings = [
    ...surface.warnings,
    "additional_evidence_required_before_progression",
  ];

  return {
    generatedAtMs: Date.now(),
    workflowState: "observation_hold",
    terminal: false,
    nextCheckRecommended: true,
    nextCheckMode: "observe_again",
    summary:
      "Voice case remains on observation hold pending stronger evidence or improved trust-aware stability.",
    workflowInstruction:
      "Continue observation and re-evaluate after additional stable runtime evidence.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 3 — risk_block_recovery
 *
 * Triggered by:
 *   - surface.decision === "approval_blocked"
 *
 * The case enters a blocked recovery workflow due to risk or instability.
 */
function buildRiskBlockRecovery(
  surface: VoiceHumanApprovalDecisionSurface,
): VoicePostDecisionWorkflowState {
  const reasons = [
    ...surface.reasons,
    "approval_surface_is_blocked",
    "workflow_enters_recovery_loop",
  ];
  const warnings = [
    ...surface.warnings,
    "workflow_progression_blocked_until_recovery",
  ];

  return {
    generatedAtMs: Date.now(),
    workflowState: "risk_block_recovery",
    terminal: false,
    nextCheckRecommended: true,
    nextCheckMode: "recover_then_recheck",
    summary:
      "Voice case is in blocked recovery workflow due to risk or instability in the approval path.",
    workflowInstruction:
      "Do not progress approval. Continue stabilization or incident handling, then recheck readiness.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

/**
 * RULE 4 — passive_monitoring (safe fallback)
 *
 * Triggered by:
 *   - unrecognized or unknown surface.decision
 *
 * Safe fallback state — no active progression required.
 */
function buildPassiveMonitoring(
  surface: VoiceHumanApprovalDecisionSurface,
): VoicePostDecisionWorkflowState {
  const reasons = [...surface.reasons];
  const warnings = [
    ...surface.warnings,
    "workflow_fallback_state_used",
  ];

  return {
    generatedAtMs: Date.now(),
    workflowState: "passive_monitoring",
    terminal: false,
    nextCheckRecommended: false,
    nextCheckMode: "none",
    summary:
      "Voice case is in passive monitoring fallback state.",
    workflowInstruction:
      "No active progression required. Maintain passive monitoring.",
    reasons: Array.from(new Set(reasons)).sort(),
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

// ============================================================================
// Core workflow state function
// ============================================================================

/**
 * Determine the post-decision workflow state from a human approval decision surface.
 * Pure function — deterministic, bounded, read-only.
 */
export function determineVoicePostDecisionWorkflowState(
  surface: VoiceHumanApprovalDecisionSurface,
): VoicePostDecisionWorkflowState {
  switch (surface.decision) {
    case "approval_open":
      return buildAwaitingHumanApproval(surface);
    case "approval_deferred":
      return buildObservationHold(surface);
    case "approval_blocked":
      return buildRiskBlockRecovery(surface);
    default:
      return buildPassiveMonitoring(surface);
  }
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a post-decision workflow state for operator review.
 * Designed for CLI output, Telegram admin messages, or future dashboards.
 */
export function formatVoicePostDecisionWorkflowState(
  state: VoicePostDecisionWorkflowState,
): string {
  const lines = [
    `🧭 Voice Workflow State`,
    `• workflow state: ${state.workflowState}`,
    `• terminal: ${state.terminal ? "yes" : "no"}`,
    `• next check recommended: ${state.nextCheckRecommended ? "yes" : "no"}`,
    `• next check mode: ${state.nextCheckMode}`,
    `• summary: ${state.summary}`,
    `• workflow instruction: ${state.workflowInstruction}`,
  ];

  if (state.reasons.length > 0) {
    lines.push(`• reasons: ${state.reasons.join(", ")}`);
  }
  if (state.warnings.length > 0) {
    lines.push(`• warnings: ${state.warnings.join(", ")}`);
  }

  return lines.join("\n");
}
