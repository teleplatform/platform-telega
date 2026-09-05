export type MissionStatus =
  | "draft" | "active" | "paused" | "completed" | "failed" | "cancelled";

export type MissionPriority = "low" | "normal" | "high" | "critical";

export interface Mission {
  id: string;
  title: string;
  description: string;
  status: MissionStatus;
  priority: MissionPriority;
  goals: MissionGoal[];
  graphIds: string[];
  capsuleIds: string[];
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  tags: string[];
}

export interface MissionGoal {
  id: string;
  title: string;
  description: string;
  status: "pending" | "active" | "completed" | "failed";
  graphId: string | null;
}

export interface MissionProgress {
  totalGoals: number;
  completedGoals: number;
  failedGoals: number;
  activeGoals: number;
  totalGraphs: number;
  completedGraphs: number;
  totalCapsules: number;
  durationMs: number | null;
}

export interface MissionSummary {
  id: string;
  title: string;
  status: MissionStatus;
  priority: MissionPriority;
  goalCount: number;
  completedGoals: number;
  graphCount: number;
  capsuleCount: number;
  createdAt: number;
}
