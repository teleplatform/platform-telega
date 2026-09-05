export type JobStatus =
  | "pending" | "ready" | "running" | "completed" | "failed" | "skipped" | "blocked";

export type JobPriority = "low" | "normal" | "high" | "critical";

export interface JobNode {
  id: string;
  title: string;
  description: string;
  agentId: string;
  status: JobStatus;
  priority: JobPriority;
  dependsOn: string[];
  result: string | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
}

export interface JobEdge {
  from: string;
  to: string;
  type: "depends_on" | "triggers" | "blocks";
}

export interface JobGraph {
  id: string;
  title: string;
  description: string;
  nodes: JobNode[];
  edges: JobEdge[];
  status: "created" | "running" | "completed" | "failed" | "cancelled";
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface JobGraphSummary {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  blocked: number;
  durationMs: number | null;
}
