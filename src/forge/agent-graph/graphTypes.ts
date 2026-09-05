export type GraphNodeStatus = "pending" | "ready" | "running" | "completed" | "failed" | "blocked" | "skipped";

export interface GraphNode {
  taskId: string;
  title: string;
  status: GraphNodeStatus;
  dependsOn: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  type: "depends_on";
}

export interface TaskGraph {
  id: string;
  name: string;
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  status: "created" | "running" | "completed" | "failed";
  missionId: string | null;
  spaceId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface GraphPlannerResult {
  graphId: string;
  readyTasks: string[];
  blockedTasks: string[];
  completedTasks: string[];
  failedTasks: string[];
  pendingTasks: string[];
  levels: string[][];
  hasBlockers: boolean;
}
