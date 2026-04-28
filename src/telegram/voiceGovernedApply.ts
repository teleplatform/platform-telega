/**
 * Voice Governed Apply & Controlled Change Execution Layer v4.6
 *
 * Takes approved review decisions and executes changes safely — validating
 * policy gates, preventing forbidden mutations, and recording apply effects
 * as part of the execution truth fabric.
 *
 * This layer answers:
 *   - "Can this approved decision be safely applied?"
 *   - "Does the change violate any policy or consistency constraints?"
 *   - "What is the execution status and effect confirmation?"
 *
 * This layer does NOT:
 *   - bypass review decisions
 *   - mutate runtime config directly (advisory execution model)
 *   - apply without approval
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";
import type { VoiceReviewDecision } from "./voiceReviewQueueOrchestration.js";
import type { VoiceChangeProposal } from "./voiceGovernedChangeProposal.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceApplyStatus =
  | "pending"
  | "validated"
  | "applied"
  | "failed"
  | "rolled_back";

export type VoiceApplyTargetType =
  | "policy"
  | "threshold"
  | "reaction_mapping";

export type VoiceApplyValidationError =
  | "missing_approval"
  | "forbidden_change"
  | "policy_violation"
  | "consistency_conflict"
  | "invalid_change_format";

export const FORBIDDEN_APPLY_TARGETS = [
  "disable_consistency_guard",
  "disable_safety_gate",
  "weaken_human_review",
  "self_expand_privileges",
  "mutate_audit_seal",
  "bypass_execution_gate",
  "disable_admission_gate",
  "disable_review_queue",
];

export interface VoiceApplyTask {
  applyId: string;

  proposalId: string;
  decisionId?: string;
  traceId: string;

  approvedBy?: "human_operator" | "creator";

  applyStatus: VoiceApplyStatus;

  applyTarget: {
    type: VoiceApplyTargetType;
    key: string;
  };

  change: {
    from?: unknown;
    to: unknown;
  };

  validationErrors: VoiceApplyValidationError[];

  createdAt: number;
  appliedAt?: number;
  rolledBackAt?: number;
}

export interface VoiceRollbackRecord {
  applyId: string;

  reason:
    | "instability_detected"
    | "policy_violation"
    | "manual_revert";

  rolledBackAt: number;
}

export interface ExecuteVoiceApplyTaskInput {
  proposal: VoiceChangeProposal;
  reviewDecision?: VoiceReviewDecision;
}

// ============================================================================
// ID generation
// ============================================================================

function generateApplyId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString("hex");
  return `voice_apply_${timestamp}_${random}`;
}

function generateRollbackId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString("hex");
  return `voice_rollback_${timestamp}_${random}`;
}

// ============================================================================
// Validation gate
// ============================================================================

function validateApplyTask(
  proposal: VoiceChangeProposal,
  reviewDecision?: VoiceReviewDecision,
): VoiceApplyValidationError[] {
  const errors: VoiceApplyValidationError[] = [];

  // RULE 1 — must have approval
  if (!reviewDecision || reviewDecision.decision !== "approved") {
    errors.push("missing_approval");
  }

  // RULE 2 — forbidden targets
  const target = proposal.suggestedChange.target.toLowerCase();
  if (FORBIDDEN_APPLY_TARGETS.some((p) => target.includes(p))) {
    errors.push("forbidden_change");
  }

  // RULE 3 — invalid change format
  if (
    proposal.suggestedChange.proposedValue === undefined ||
    proposal.suggestedChange.proposedValue === null
  ) {
    errors.push("invalid_change_format");
  }

  return errors;
}

// ============================================================================
// Core apply executor
// ============================================================================

/**
 * Execute a governed apply task — validates, executes (advisory), records.
 * Pure function — deterministic, bounded, read-only (except timestamp).
 */
export function executeVoiceApplyTask(
  input: ExecuteVoiceApplyTaskInput,
): VoiceApplyTask {
  const applyId = generateApplyId();
  const errors = validateApplyTask(input.proposal, input.reviewDecision);
  const now = Date.now();

  const applyStatus: VoiceApplyStatus =
    errors.length > 0 ? "failed" : "applied";

  return {
    applyId,
    proposalId: input.proposal.proposalId,
    decisionId: input.reviewDecision?.taskId,
    traceId: input.proposal.traceId,
    approvedBy: input.reviewDecision?.decidedBy,
    applyStatus,
    applyTarget: {
      type: mapProposalTypeToTarget(input.proposal.proposalType),
      key: input.proposal.suggestedChange.target,
    },
    change: {
      from: input.proposal.suggestedChange.currentValue,
      to: input.proposal.suggestedChange.proposedValue,
    },
    validationErrors: errors,
    createdAt: now,
    appliedAt: errors.length === 0 ? now : undefined,
  };
}

function mapProposalTypeToTarget(
  proposalType: import("./voiceGovernedChangeProposal.js").VoiceProposalType,
): VoiceApplyTargetType {
  switch (proposalType) {
    case "policy_adjustment":
      return "policy";
    case "threshold_tuning":
      return "threshold";
    case "reaction_strategy_change":
      return "reaction_mapping";
    case "cooling_adjustment":
      return "threshold";
  }
}

// ============================================================================
// Rollback executor
// ============================================================================

/**
 * Create a rollback record for a failed or regressing apply.
 */
export function createVoiceRollbackRecord(
  applyId: string,
  reason: VoiceRollbackRecord["reason"],
): VoiceRollbackRecord {
  return {
    applyId,
    reason,
    rolledBackAt: Date.now(),
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceApplyTask(
  task: VoiceApplyTask,
): string {
  const lines = [
    `⚡ Voice Apply Task`,
    `• apply ID: ${task.applyId}`,
    `• proposal ID: ${task.proposalId}`,
    `• status: ${task.applyStatus}`,
    `• target: ${task.applyTarget.type} → ${task.applyTarget.key}`,
    `• approved by: ${task.approvedBy ?? "N/A"}`,
  ];

  if (task.validationErrors.length > 0) {
    lines.push(`• errors: ${task.validationErrors.join(", ")}`);
  }
  if (task.appliedAt) {
    lines.push(`• applied at: ${new Date(task.appliedAt).toISOString()}`);
  }

  return lines.join("\n");
}

export function formatVoiceRollbackRecord(
  record: VoiceRollbackRecord,
): string {
  return [
    `↩️ Voice Rollback Record`,
    `• apply ID: ${record.applyId}`,
    `• reason: ${record.reason}`,
    `• rolled back at: ${new Date(record.rolledBackAt).toISOString()}`,
  ].join("\n");
}
