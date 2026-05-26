import type { ExecutableTask, Action, ExecutionCheckpoint } from "./execution-types.js";
import { getTask, getAllTasks, updateTask, addTask } from "./execution-store.js";
import { executeAction } from "./execution-actions.js";
import { linkEvidence } from "./execution-evidence.js";
import { recordOperation } from "../memory/operational-memory.js";
import { checkAction } from "../governance/governance-gate.js";
import { recordExecution, recordBlocked, initBudget, releaseBudget, canAcceptNewTask } from "../governance/governance-budget.js";
import { recordBlockedAction } from "../governance/governance-evidence.js";
import { requestApproval, approveAction } from "../governance/governance-approval.js";

export type ExecutionEvent =
  | { kind: "task_started"; taskId: string }
  | { kind: "action_started"; taskId: string; actionId: string }
  | { kind: "action_done"; taskId: string; actionId: string; result: unknown }
  | { kind: "action_failed"; taskId: string; actionId: string; error: string }
  | { kind: "action_retry"; taskId: string; actionId: string; attempt: number }
  | { kind: "task_done"; taskId: string }
  | { kind: "task_failed"; taskId: string };

const eventLog: ExecutionEvent[] = [];
const MAX_EVENTS = 200;

function logEvent(event: ExecutionEvent): void {
  eventLog.push(event);
  if (eventLog.length > MAX_EVENTS) eventLog.shift();
}

export function getEventLog(): ExecutionEvent[] {
  return [...eventLog];
}

export async function enqueueTask(task: ExecutableTask): Promise<void> {
  addTask(task);
  recordOperation("task_enqueued", `${task.title} (${task.actions.length} actions)`);
}

export async function runTask(taskId: string): Promise<ExecutableTask> {
  let task = getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  if (!canAcceptNewTask()) {
    task = updateTask(taskId, {
      status: "cancelled",
      evidence: [...task.evidence, "governance: max concurrent tasks reached"],
    })!;
    logEvent({ kind: "task_failed", taskId });
    recordOperation("task_blocked", `${task.title} — max concurrent tasks`);
    releaseBudget(taskId);
    return task;
  }

  initBudget(taskId);
  task = updateTask(taskId, { status: "running" })!;
  logEvent({ kind: "task_started", taskId });
  recordOperation("task_started", task.title);

  for (let i = 0; i < task.actions.length; i++) {
    const action: Action = task.actions[i];
    const actionResult = await executeActionWithRetry(task, action);
    task = getTask(taskId)!;

    if (actionResult.status === "failed") {
      task = updateTask(taskId, {
        status: "failed",
        evidence: [...task.evidence, `action_failed: ${action.label} — ${actionResult.error}`],
      })!;
      logEvent({ kind: "task_failed", taskId });
      recordOperation("task_failed", `${task.title} at action ${action.label}: ${actionResult.error}`);
      releaseBudget(taskId);
      return task;
    }

    const checkpoint: ExecutionCheckpoint = {
      stage: action.label,
      data: { actionId: action.id, result: actionResult.result },
      timestamp: Date.now(),
    };

    task = updateTask(taskId, {
      actions: task.actions.map((a, idx) =>
        idx === i ? { ...a, status: "done" as const, result: actionResult.result, checkpoint } : a
      ),
      evidence: [...task.evidence, `action_completed: ${action.label}`],
    })!;

    logEvent({ kind: "action_done", taskId, actionId: action.id, result: actionResult.result });

    if (actionResult.evidence) {
      linkEvidence(taskId, action.id, actionResult.evidence);
    }
  }

  task = updateTask(taskId, { status: "done", evidence: [...getTask(taskId)!.evidence, "task_completed"] })!;
  logEvent({ kind: "task_done", taskId });
  recordOperation("task_completed", task.title);
  releaseBudget(taskId);
  return task;
}

async function executeActionWithRetry(
  task: ExecutableTask,
  action: Action,
): Promise<{ status: "done" | "failed"; result?: unknown; error?: string; evidence?: string }> {
  const decision = checkAction(action);

  if (decision.blocked) {
    recordBlockedAction(task.id, action.id, action.label, action.type, decision.risk, decision.reason, decision.policyMatch);
    recordBlocked(task.id);
    recordOperation("action_blocked", `${task.title}/${action.label}: ${decision.reason}`);
    return { status: "failed", error: `governance: ${decision.reason}`, evidence: `governance_blocked: ${decision.reason}` };
  }

  if (decision.requiresApproval) {
    const approval = requestApproval(task.id, action.id, action.label, action.type, decision.risk as "high" | "critical", decision.reason, action.params);
    const approved = approveAction(approval.id, "auto");
    if (approved?.status !== "approved") {
      recordBlockedAction(task.id, action.id, action.label, action.type, decision.risk, `approval rejected: ${decision.reason}`, decision.policyMatch);
      recordBlocked(task.id);
      recordOperation("action_rejected", `${task.title}/${action.label}: ${decision.reason}`);
      return { status: "failed", error: `governance: approval rejected — ${decision.reason}`, evidence: `governance_rejected: ${decision.reason}` };
    }
    recordOperation("action_approved", `${task.title}/${action.label}: ${decision.reason}`);
  }

  if (!recordExecution(task.id)) {
    return { status: "failed", error: "governance: budget exceeded — max actions per task reached", evidence: "governance_budget: max actions" };
  }

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= action.maxRetries; attempt++) {
    if (attempt > 0) {
      logEvent({ kind: "action_retry", taskId: task.id, actionId: action.id, attempt });
      updateTask(task.id, {
        actions: task.actions.map(a =>
          a.id === action.id ? { ...a, status: "retrying" as const, retryCount: attempt } : a
        ),
      });
    }

    try {
      logEvent({ kind: "action_started", taskId: task.id, actionId: action.id });
      const result = await executeAction(action);
      return { status: "done", result: result.result, evidence: result.evidence };
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e);
      logEvent({ kind: "action_failed", taskId: task.id, actionId: action.id, error: lastError });
    }
  }

  return { status: "failed", error: lastError };
}
