import type { AsyncTask, AsyncTaskStatus } from "../../runtime-task-contracts/src/task.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

const ALLOWED_TRANSITIONS: Record<AsyncTaskStatus, AsyncTaskStatus[]> = {
  queued: ["planning"],
  planning: ["running", "failed"],
  running: ["waiting_human", "paused", "completed", "failed"],
  waiting_human: ["running", "cancelled"],
  paused: ["running", "failed"],
  blocked: ["running", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTaskTransition(from: AsyncTaskStatus, to: AsyncTaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionTaskStatus(task: AsyncTask, to: AsyncTaskStatus): boolean {
  if (!canTaskTransition(task.status, to)) return false;
  task.status = to;
  task.updated_at = nowIso();
  return true;
}

export function createAsyncTask(input: {
  tele_user_id: string;
  workspace_id?: string;
  session_id?: string;
  goal: string;
  task_class?: string;
  execution_mode?: string;
  risk_level?: "low" | "medium" | "high";
  delivery_targets?: string[];
}): AsyncTask {
  return {
    task_id: `task_${randomUUID()}`,
    tele_user_id: input.tele_user_id,
    workspace_id: input.workspace_id,
    session_id: input.session_id,
    goal: input.goal.trim(),
    task_class: input.task_class,
    status: "queued",
    execution_mode: input.execution_mode,
    risk_level: input.risk_level ?? "low",
    delivery_targets: input.delivery_targets ?? ["telegram"],
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

export function advanceTaskLifecycle(task: AsyncTask, event: string): boolean {
  const transitions: Record<string, AsyncTaskStatus> = {
    start_planning: "planning",
    start_running: "running",
    complete: "completed",
    fail: "failed",
  };
  const next = transitions[event];
  if (!next) return false;
  return transitionTaskStatus(task, next);
}

export function pauseTask(task: AsyncTask, reason?: string): boolean {
  return transitionTaskStatus(task, "paused");
}

export function completeTask(task: AsyncTask): boolean {
  return transitionTaskStatus(task, "completed");
}

export function failTask(task: AsyncTask, reason?: string): boolean {
  return transitionTaskStatus(task, "failed");
}

export function buildTaskSummary(task: AsyncTask): string {
  return `Task ${task.task_id}: ${task.status} | goal: ${task.goal.substring(0, 50)} | risk: ${task.risk_level}`;
}
