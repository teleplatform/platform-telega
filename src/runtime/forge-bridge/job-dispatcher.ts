import type { BuildTask, BuildResult } from "../../types/telecore.js";
import { getForgeBridge } from "./forge-bridge.js";
import type { ForgeTaskKind } from "./forge-bridge.types.js";
import { getExecutorRouter } from "./executor-router.js";
import { getTaskGroupStore } from "./task-group-store.js";
import type { CreateTaskGroupParams, TaskGroup, TaskGroupDispatchResult, ChildTaskStatus, TaskGroupCancelParams } from "./task-group-types.js";
import { emitGroupEvent } from "./task-group-stream-store.js";

export interface DispatchedBuildResult {
  summary: BuildResult["summary"];
  execution?: {
    trace_id?: string;
    duration_ms?: number;
  };
  diagnostics?: { error?: string; [k: string]: unknown };
  executor?: {
    target?: string;
    id?: string;
  };
}

export async function createTaskGroup(params: CreateTaskGroupParams): Promise<TaskGroup> {
  const store = getTaskGroupStore();
  const group_id = `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const group = await store.create({
    group_id,
    parent_task_id: params.parent_task_id,
    child_task_ids: params.child_task_ids,
    group_strategy: params.group_strategy ?? "parallel",
    execution_mode: params.execution_mode,
  });
  emitGroupEvent(group_id, "group_created", { group_strategy: params.group_strategy ?? "parallel" });
  return group;
}

export async function getTaskGroup(group_id: string): Promise<TaskGroup | undefined> {
  const store = getTaskGroupStore();
  return store.get(group_id);
}

export interface TaskGroupCancelResult {
  group_id: string;
  cancelled_tasks: string[];
  needs_creator_tasks: string[];
  summary: string;
}

export async function cancelTaskGroup(group_id: string, params: TaskGroupCancelParams = {}): Promise<TaskGroupCancelResult> {
  const store = getTaskGroupStore();
  const group = await store.get(group_id);
  
  if (!group) {
    return {
      group_id,
      cancelled_tasks: [],
      needs_creator_tasks: [],
      summary: "Group not found",
    };
  }

  const cancelled_tasks: string[] = [];
  const needs_creator_tasks: string[] = [];

  if (group.group_status === "done" || group.group_status === "cancelled") {
    return {
      group_id,
      cancelled_tasks: [],
      needs_creator_tasks: [],
      summary: `Group already ${group.group_status}`,
    };
  }

  const mode = params.mode ?? "graceful";
  const reason = params.reason ?? "Creator requested cancellation";

  if (mode === "needs_creator") {
    group.child_task_ids.forEach((taskId) => {
      needs_creator_tasks.push(taskId);
    });
    await store.updateStatus(group_id, "needs_creator");
    emitGroupEvent(group_id, "group_needs_creator", { reason });
  } else {
    group.child_task_ids.forEach((taskId) => {
      cancelled_tasks.push(taskId);
    });
    await store.updateStatus(group_id, "cancelled");
    emitGroupEvent(group_id, "group_cancelled", { reason, cancelled_count: cancelled_tasks.length });
  }

  return {
    group_id,
    cancelled_tasks,
    needs_creator_tasks,
    summary: mode === "needs_creator" 
      ? `Group needs creator decision: ${reason}`
      : `Group cancelled: ${reason}`,
  };
}

export async function dispatchTaskGroup(group_id: string): Promise<TaskGroupDispatchResult> {
  const store = getTaskGroupStore();
  const group = await store.get(group_id);
  
  if (!group) {
    emitGroupEvent(group_id, "group_failed", { reason: "Group not found" });
    return {
      group_id,
      dispatched_tasks: [],
      failed_tasks: [],
      summary: "Group not found",
    };
  }

  emitGroupEvent(group_id, "dag_created", { child_count: group.child_task_ids.length, phase: "dispatch" });
  emitGroupEvent(group_id, "group_created", { group_strategy: group.group_strategy });

  if (group.group_strategy === "race") {
    emitGroupEvent(group_id, "group_failed", { reason: "Race strategy not yet implemented" });
    return {
      group_id,
      dispatched_tasks: [],
      failed_tasks: group.child_task_ids,
      summary: "Race strategy not yet implemented",
    };
  }

  return dispatchReadyDagTasks(group, store);
}

async function dispatchReadyDagTasks(
  group: TaskGroup,
  store: ReturnType<typeof getTaskGroupStore>
): Promise<TaskGroupDispatchResult> {
  const maxConcurrency = group.group_strategy === "parallel" ? 2 : 1;
  const dispatched_tasks: string[] = [];
  const failed_tasks: string[] = [];

  emitGroupEvent(group.group_id, "group_dispatch_started", { max_concurrency: maxConcurrency });
  await store.updateStatus(group.group_id, "running");

  let remainingTasks = [...group.child_task_ids];
  
  while (remainingTasks.length > 0) {
    const readiness = await store.evaluateTaskReadiness(group.group_id);
    const readyTaskIds = readiness.filter(r => r.readiness === "ready").map(r => r.task_id);
    
    if (readyTaskIds.length === 0) {
      const blockedTasks = readiness.filter(r => r.readiness === "blocked").map(r => r.task_id);
      const failedTasks = readiness.filter(r => r.readiness === "failed").map(r => r.task_id);
      failed_tasks.push(...failedTasks);
      remainingTasks = [...blockedTasks];
      if (blockedTasks.length > 0) {
        await store.updateStatus(group.group_id, "partial");
        return {
          group_id: group.group_id,
          dispatched_tasks,
          failed_tasks,
          summary: `Blocked: ${blockedTasks.join(", ")}. Completed: ${dispatched_tasks.length}`,
        };
      }
      break;
    }

    const batch = readyTaskIds.slice(0, maxConcurrency);
    
    const results = await Promise.all(
      batch.map(async (taskId) => {
        emitGroupEvent(group.group_id, "child_task_started", { task_id: taskId });
        try {
          const bridge = getForgeBridge();
          await bridge.run({
            userId: "dispatch",
            kind: "run_bridge_task",
            target: "kilo_mcp",
            input: { group_task: true },
          });
          dispatched_tasks.push(taskId);
          emitGroupEvent(group.group_id, "child_task_completed", { task_id: taskId, status: "done" });
          return { task_id: taskId, status: "done" as ChildTaskStatus };
        } catch (err) {
          failed_tasks.push(taskId);
          emitGroupEvent(group.group_id, "child_task_completed", { task_id: taskId, status: "failed" });
          return { task_id: taskId, status: "failed" as ChildTaskStatus };
        }
      })
    );

    remainingTasks = remainingTasks.filter(id => !dispatched_tasks.includes(id) && !failed_tasks.includes(id));
  }

  const finalStatus = failed_tasks.length > 0 ? "partial" : "done";
  await store.updateStatus(group.group_id, finalStatus);
  
  if (finalStatus === "done") {
    emitGroupEvent(group.group_id, "group_done", { dispatched_count: dispatched_tasks.length });
  } else {
    emitGroupEvent(group.group_id, "group_partial", { failed_count: failed_tasks.length });
  }

  return {
    group_id: group.group_id,
    dispatched_tasks,
    failed_tasks,
    summary: `Dispatched ${dispatched_tasks.length} tasks, ${failed_tasks.length} failed`,
  };
}

function mapToForgeParams(task: BuildTask) {
  const taskId = (task as any).task_id || task.meta?.task_id || `task_${Date.now()}`;
  const rawKind = (task as any).execution?.kind || (task as any).kind || "run_bridge_task";
  const safeKinds = ["create_file","read_file","update_file","delete_file","list_files","run_code","run_bridge_task","verify_runtime","open_project","generic","analyze_repo","generate_patch"] as const;
  const kind = (safeKinds as readonly string[]).includes(rawKind) ? rawKind : "run_bridge_task";
  const target = (task as any).execution?.target;
  const path = (task as any).execution?.path;
  const input = (task as any).execution?.input || { prompt: task.goal?.title };
  const userId = (task as any).context?.user_id || (task as any).context?.creator_id || (task as any).meta?.user_id || "creator";
  return { taskId, kind, target, path, input, userId };
}

export async function dispatchBuildTask(
  task: BuildTask,
  traceId: string,
): Promise<DispatchedBuildResult> {
  const { taskId, kind, target, path, input, userId } = mapToForgeParams(task);
  const start = Date.now();

  try {
    const router = getExecutorRouter();
    let resolvedTarget: string | undefined;
    let executorId: string | undefined;

    if (router) {
      const forgeTask = {
        taskId,
        target: target || "auto",
        kind,
        userId,
        path,
        input,
      };
      const resolution = router.resolveExecutor(forgeTask as any);
      resolvedTarget = resolution.target;
      executorId = resolution.target;
    } else {
      resolvedTarget = target || "kilo_mcp";
      executorId = resolvedTarget;
    }

    const bridge = getForgeBridge();
    const result = await bridge.run({ userId, kind: kind as ForgeTaskKind, target: resolvedTarget as any, path, input });
    const duration_ms = Date.now() - start;
    return {
      summary: {
        status: (result as any).status || "done",
        task_id: taskId,
        mode_used: task.meta?.mode || "smart",
        iterations_used: 1,
      },
      execution: { trace_id: traceId, duration_ms },
      executor: { target: resolvedTarget, id: executorId },
    };
  } catch (err: any) {
    return {
      summary: {
        status: "failed",
        task_id: taskId,
        mode_used: task.meta?.mode || "smart",
        iterations_used: 0,
      },
      execution: { trace_id: traceId, duration_ms: Date.now() - start },
      diagnostics: { error: String(err) },
      executor: { target: target || "auto", id: undefined },
    };
  }
}