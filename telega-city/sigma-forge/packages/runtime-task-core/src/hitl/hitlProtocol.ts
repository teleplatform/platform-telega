import type { HumanHandoffPacket, HandoffReasonCode } from "../../runtime-task-contracts/src/handoff.js";
import type { HumanDecision, HumanDecisionAction } from "../../runtime-task-contracts/src/decision.js";
import type { AsyncTask, AsyncTaskStatus } from "../../runtime-task-contracts/src/task.js";
import { transitionTaskStatus } from "../task/taskLifecycle.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export const ALL_HANDOFF_REASONS: HandoffReasonCode[] = [
  "RISK_HIGH",
  "APPROVAL_REQUIRED",
  "POLICY_BLOCK",
  "CONFIDENCE_LOW",
  "COMMERCIAL_DECISION",
  "MANUAL_REVIEW_REQUIRED",
  "USER_INPUT_REQUIRED",
];

export function isValidHandoffReason(reason: string): reason is HandoffReasonCode {
  return ALL_HANDOFF_REASONS.includes(reason as HandoffReasonCode);
}

export function createHumanHandoffPacket(input: {
  task_id: string;
  run_id?: string;
  summary: string;
  completed_steps?: string[];
  blocked_reason?: string;
  recommended_action?: string;
  draft_output?: string;
  required_human_input?: string[];
  risk_flags?: string[];
  rejected_options?: string[];
  reason_code: HandoffReasonCode;
}): HumanHandoffPacket {
  return {
    handoff_id: `handoff_${randomUUID()}`,
    task_id: input.task_id,
    run_id: input.run_id,
    summary: input.summary,
    completed_steps: input.completed_steps ?? [],
    blocked_reason: input.blocked_reason,
    recommended_action: input.recommended_action,
    draft_output: input.draft_output,
    required_human_input: input.required_human_input,
    risk_flags: input.risk_flags,
    rejected_options: input.rejected_options,
    reason_code: input.reason_code,
    created_at: nowIso(),
  };
}

export function resolveHumanDecision(packet: HumanHandoffPacket, decision: HumanDecision): {
  next_task_status: AsyncTaskStatus;
  next_action: string;
  notes: string;
} {
  switch (decision.action) {
    case "approve":
      return { next_task_status: "running", next_action: "continue_execution", notes: decision.editor_notes ?? "Approved" };
    case "edit":
      return { next_task_status: "running", next_action: "continue_with_edits", notes: decision.editor_notes ?? "Edited" };
    case "reject":
      return { next_task_status: "cancelled", next_action: "cancel_task", notes: decision.editor_notes ?? "Rejected" };
    case "reroute":
      return { next_task_status: "planning", next_action: "reroute_task", notes: decision.editor_notes ?? `Reroute to ${decision.reroute_target}` };
    case "escalate":
      return { next_task_status: "waiting_human", next_action: "escalate", notes: decision.editor_notes ?? "Escalated" };
    case "takeover":
      return { next_task_status: "completed", next_action: "manual_takeover", notes: decision.editor_notes ?? "Manual takeover" };
    default:
      return { next_task_status: "paused", next_action: "unknown", notes: "Unknown decision action" };
  }
}

export function handoffTask(task: AsyncTask, context: {
  summary: string;
  completed_steps?: string[];
  blocked_reason?: string;
  recommended_action?: string;
  draft_output?: string;
  required_human_input?: string[];
  risk_flags?: string[];
  rejected_options?: string[];
  reason_code: HandoffReasonCode;
}): { packet: HumanHandoffPacket; task_status_changed: boolean } {
  const packet = createHumanHandoffPacket({
    task_id: task.task_id,
    run_id: task.run_id,
    summary: context.summary,
    completed_steps: context.completed_steps,
    blocked_reason: context.blocked_reason,
    recommended_action: context.recommended_action,
    draft_output: context.draft_output,
    required_human_input: context.required_human_input,
    risk_flags: context.risk_flags,
    rejected_options: context.rejected_options,
    reason_code: context.reason_code,
  });

  const task_status_changed = transitionTaskStatus(task, "waiting_human");

  return { packet, task_status_changed };
}

export function resumeTaskFromDecision(task: AsyncTask, decision: HumanDecision): { next_status: AsyncTaskStatus; action: string } {
  const packet = { handoff_id: decision.handoff_id, task_id: decision.task_id, summary: "", completed_steps: [], reason_code: "APPROVAL_REQUIRED" as HandoffReasonCode, created_at: "" } as HumanHandoffPacket;
  const resolution = resolveHumanDecision(packet, decision);
  transitionTaskStatus(task, resolution.next_task_status);
  return { next_status: resolution.next_task_status, action: resolution.next_action };
}
