/**
 * Voice Review Queue & Human Decision Orchestration Layer v4.5
 *
 * Takes admitted change proposals and creates review tasks with proper
 * assignment, priority ordering, deadlines, and escalation — transforming
 * a stream of proposals into a managed human decision workflow.
 *
 * This layer answers:
 *   - "Who should review this proposal and when?"
 *   - "What is the deadline and escalation path?"
 *   - "How should the review queue be ordered?"
 *
 * This layer does NOT:
 *   - execute the review decision
 *   - apply any changes
 *   - mutate runtime config
 *   - use DB / ML / external dependencies
 */

import crypto from "node:crypto";
import type { VoiceProposalAdmissionResult, VoiceProposalNormalizedPriority, VoiceReviewMode } from "./voiceProposalAdmissionGate.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceReviewTaskAssignee =
  | "human_operator"
  | "creator"
  | "auto_review";

export type VoiceReviewTaskPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type VoiceReviewTaskStatus =
  | "pending"
  | "acknowledged"
  | "in_review"
  | "resolved"
  | "expired";

export type VoiceReviewTaskEscalation =
  | "none"
  | "warning"
  | "critical";

export const REVIEW_DEADLINE_MS: Record<VoiceReviewTaskPriority, number> = {
  critical: 5 * 60 * 1000,       // 5 minutes
  high: 30 * 60 * 1000,          // 30 minutes
  medium: 2 * 60 * 60 * 1000,    // 2 hours
  low: 24 * 60 * 60 * 1000,      // 24 hours
} as const;

export interface VoiceReviewTask {
  taskId: string;
  proposalId: string;
  traceId: string;

  assignedTo: VoiceReviewTaskAssignee;

  priority: VoiceReviewTaskPriority;

  status: VoiceReviewTaskStatus;

  deadlineAt: number;

  escalationLevel: VoiceReviewTaskEscalation;

  createdAt: number;
  updatedAt: number;
}

export interface VoiceReviewDecision {
  taskId: string;
  proposalId: string;

  decision:
    | "approved"
    | "rejected"
    | "needs_revision";

  decidedBy:
    | "human_operator"
    | "creator";

  decisionNotes?: string;

  decidedAt: number;
}

export interface CreateVoiceReviewTaskInput {
  admissionResult: VoiceProposalAdmissionResult;
}

// ============================================================================
// ID generation
// ============================================================================

function generateTaskId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString("hex");
  return `voice_review_${timestamp}_${random}`;
}

// ============================================================================
// Assignment mapping
// ============================================================================

function mapAssignee(
  reviewMode: VoiceReviewMode,
): VoiceReviewTaskAssignee | null {
  switch (reviewMode) {
    case "standard":
      return "human_operator";
    case "human_required":
      return "human_operator";
    case "creator_only":
      return "creator";
    case "blocked":
      return null;
  }
}

// ============================================================================
// Core review task creator
// ============================================================================

/**
 * Create a review task from an admitted proposal.
 * Pure function — deterministic, bounded, read-only.
 */
export function createVoiceReviewTask(
  input: CreateVoiceReviewTaskInput,
): VoiceReviewTask | null {
  const assignee = mapAssignee(input.admissionResult.reviewMode);

  // Blocked review mode → no task
  if (assignee === null) {
    return null;
  }

  const taskId = generateTaskId();
  const now = Date.now();
  const priority = mapPriority(input.admissionResult.normalizedPriority);
  const deadlineMs = REVIEW_DEADLINE_MS[priority];
  const deadlineAt = now + deadlineMs;

  const escalationLevel =
    priority === "critical" ? "warning"
      : input.admissionResult.admissionStatus === "escalated" ? "warning"
        : "none";

  return {
    taskId,
    proposalId: input.admissionResult.proposalId,
    traceId: input.admissionResult.traceId,
    assignedTo: assignee,
    priority,
    status: "pending",
    deadlineAt,
    escalationLevel,
    createdAt: now,
    updatedAt: now,
  };
}

function mapPriority(
  normalized: VoiceProposalNormalizedPriority,
): VoiceReviewTaskPriority {
  switch (normalized) {
    case "critical": return "critical";
    case "high": return "high";
    case "medium": return "medium";
    case "low": return "low";
  }
}

// ============================================================================
// Task state machine
// ============================================================================

export function transitionVoiceReviewTask(
  task: VoiceReviewTask,
  newStatus: VoiceReviewTaskStatus,
): VoiceReviewTask {
  return {
    ...task,
    status: newStatus,
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Queue ordering
// ============================================================================

export type VoiceQueueOrderingStrategy =
  | "priority_first"
  | "deadline_first";

export function orderVoiceReviewQueue(
  tasks: VoiceReviewTask[],
  strategy: VoiceQueueOrderingStrategy = "priority_first",
): VoiceReviewTask[] {
  const priorityOrder: Record<VoiceReviewTaskPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...tasks].sort((a, b) => {
    if (strategy === "priority_first") {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    // deadline_first
    return a.deadlineAt - b.deadlineAt;
  });
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceReviewTask(
  task: VoiceReviewTask,
): string {
  const deadlineDate = new Date(task.deadlineAt).toISOString();
  const lines = [
    `📋 Voice Review Task`,
    `• task ID: ${task.taskId}`,
    `• proposal ID: ${task.proposalId}`,
    `• assigned to: ${task.assignedTo}`,
    `• priority: ${task.priority}`,
    `• status: ${task.status}`,
    `• deadline: ${deadlineDate}`,
    `• escalation: ${task.escalationLevel}`,
  ];

  return lines.join("\n");
}

export function formatVoiceReviewDecision(
  decision: VoiceReviewDecision,
): string {
  const lines = [
    `✅ Voice Review Decision`,
    `• task ID: ${decision.taskId}`,
    `• proposal ID: ${decision.proposalId}`,
    `• decision: ${decision.decision}`,
    `• decided by: ${decision.decidedBy}`,
  ];

  if (decision.decisionNotes) {
    lines.push(`• notes: ${decision.decisionNotes}`);
  }

  return lines.join("\n");
}
