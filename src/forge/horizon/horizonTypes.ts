export type HorizonStatus =
  | "draft" | "active" | "paused" | "completed" | "failed" | "cancelled";

export type HorizonPhaseStatus =
  | "pending" | "active" | "completed" | "failed";

export interface HorizonMilestone {
  id: string;
  title: string;
  description: string;
  missionId: string;
  status: HorizonPhaseStatus;
  dueBy: number | null;
  completedAt: number | null;
}

export interface HorizonPhase {
  id: string;
  name: string;
  description: string;
  status: HorizonPhaseStatus;
  order: number;
  milestones: HorizonMilestone[];
  startedAt: number | null;
  completedAt: number | null;
}

export interface HorizonPlan {
  id: string;
  title: string;
  description: string;
  vision: string;
  status: HorizonStatus;
  phases: HorizonPhase[];
  missionIds: string[];
  capsuleIds: string[];
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  tags: string[];
}

export interface HorizonProgress {
  totalPhases: number;
  completedPhases: number;
  activePhases: number;
  pendingPhases: number;
  totalMilestones: number;
  completedMilestones: number;
  durationMs: number | null;
}

export interface HorizonSummary {
  id: string;
  title: string;
  status: HorizonStatus;
  phases: number;
  completedPhases: number;
  missions: number;
  capsules: number;
  createdAt: number;
}
