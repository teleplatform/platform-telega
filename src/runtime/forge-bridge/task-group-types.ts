export type TaskGroupStatus = "queued" | "running" | "partial" | "done" | "failed" | "cancelled" | "needs_creator";

export type TaskGroupStrategy = "parallel" | "sequential" | "race";

export type ChildTaskStatus = "queued" | "running" | "done" | "failed" | "cancelled" | "blocked" | "needs_creator";

export type DependencyState = "pending" | "blocked" | "ready" | "completed" | "failed";

export type TaskReadiness = "ready" | "blocked" | "failed";

export type CancellationMode = "immediate" | "graceful" | "needs_creator";

export interface TaskDependency {
  task_id: string;
  depends_on: string;
  state: DependencyState;
}

export interface TaskReadinessEvaluation {
  task_id: string;
  readiness: TaskReadiness;
  blocking_tasks: string[];
}

export interface TaskGroupCancelParams {
  mode?: CancellationMode;
  reason?: string;
}

export interface TaskGroupDispatchResult {
  group_id: string;
  dispatched_tasks: string[];
  failed_tasks: string[];
  summary: string;
}

export interface TaskGroup {
  group_id: string;
  parent_task_id?: string;
  child_task_ids: string[];
  group_status: TaskGroupStatus;
  group_trace_id: string;
  group_strategy: TaskGroupStrategy;
  created_at: string;
  updated_at: string;
  execution_mode?: "sandbox" | "creator_only" | "full";
  dependencies?: TaskDependency[];
}

export interface CreateTaskGroupParams {
  parent_task_id?: string;
  child_task_ids: string[];
  group_strategy?: TaskGroupStrategy;
  execution_mode?: "sandbox" | "creator_only" | "full";
}

export interface TaskGroupResult {
  group_id: string;
  group_trace_id: string;
  status: TaskGroupStatus;
  child_results: Array<{ task_id: string; status: string }>;
  summary: string;
}

export function aggregateTaskGroupStatus(childStatuses: ChildTaskStatus[]): TaskGroupStatus {
  if (childStatuses.length === 0) return "queued";

  const hasNeedsCreator = childStatuses.includes("needs_creator");
  const hasFailedOrBlocked = childStatuses.some((s) => s === "failed" || s === "blocked");
  const allDone = childStatuses.every((s) => s === "done");
  const allCancelled = childStatuses.every((s) => s === "cancelled");
  const allQueued = childStatuses.every((s) => s === "queued");
  const hasActive = childStatuses.some((s) => s === "running" || s === "queued");

  if (hasNeedsCreator) return "needs_creator";
  if (hasFailedOrBlocked) return "partial";
  if (allDone) return "done";
  if (allCancelled) return "cancelled";
  if (allQueued) return "queued";
  if (hasActive) return "running";

  return "partial";
}

export type TaskState = "queued" | "running" | "completed" | "failed" | "cancelled" | "blocked";

export interface DagNode {
  task_id: string;
  state: TaskState;
}

export interface DagEdge {
  from: string;
  to: string;
}

export interface DagResponse {
  group_id: string;
  nodes: DagNode[];
  edges: DagEdge[];
  ready_tasks: string[];
  blocked_tasks: string[];
  failed_tasks: string[];
  blocking_tasks: string[];
}

export type GroupEventType =
  | "group_created"
  | "group_dispatch_started"
  | "child_task_started"
  | "child_task_completed"
  | "group_progress"
  | "group_partial"
  | "group_done"
  | "group_failed"
  | "group_needs_creator"
  | "group_cancelled"
  | "dependency_added"
  | "dependency_blocked"
  | "dependency_ready"
  | "dependency_completed"
  | "dependency_failed"
  | "dag_created"
  | "dag_status_changed";

export type GroupEventPayload = Record<string, unknown>;
