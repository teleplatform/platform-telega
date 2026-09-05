export type TaskStatus = "pending" | "ready" | "running" | "completed" | "failed" | "blocked" | "cancelled";

export type TaskPriority = "low" | "normal" | "high" | "critical";

export interface TaskDependency {
  taskId: string;
  type: "blocks" | "requires" | "triggers";
}

export interface TaskBinding {
  agentId: string | null;
  spaceId: string | null;
  missionId: string | null;
  graphId: string | null;
  sessionId: string | null;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  binding: TaskBinding;
  dependsOn: TaskDependency[];
  evidenceRefs: string[];
  result: string | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface TaskSummary {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  blocked: number;
}
