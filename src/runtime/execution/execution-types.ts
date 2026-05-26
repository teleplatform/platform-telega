export type ActionType = "http" | "shell" | "file_read" | "file_write" | "composite" | "verify" | "browser_navigate" | "browser_click" | "browser_type" | "browser_screenshot" | "browser_extract" | "browser_wait";
export type ExecutionStatus = "pending" | "running" | "done" | "failed" | "retrying" | "cancelled";

export interface Action {
  id: string;
  type: ActionType;
  label: string;
  params: Record<string, unknown>;
  status: ExecutionStatus;
  result?: unknown;
  error?: string;
  retryCount: number;
  maxRetries: number;
  checkpoint?: ExecutionCheckpoint;
}

export interface ExecutionCheckpoint {
  stage: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface ExecutableTask {
  id: string;
  goalId: string;
  title: string;
  actions: Action[];
  status: ExecutionStatus;
  createdAt: number;
  updatedAt: number;
  evidence: string[];
  priority: number;
}

export function createAction(type: ActionType, label: string, params: Record<string, unknown>, maxRetries = 2): Action {
  return {
    id: `act_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    type,
    label,
    params,
    status: "pending",
    retryCount: 0,
    maxRetries,
  };
}

export function createTask(goalId: string, title: string, actions: Action[], priority = 0): ExecutableTask {
  return {
    id: `task_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    goalId,
    title,
    actions,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    evidence: [],
    priority,
  };
}

export function isTaskFinished(task: ExecutableTask): boolean {
  return task.status === "done" || task.status === "failed" || task.status === "cancelled";
}

export function getTaskProgress(task: ExecutableTask): number {
  if (task.actions.length === 0) return 0;
  const done = task.actions.filter(a => a.status === "done").length;
  return Math.round((done / task.actions.length) * 100);
}
