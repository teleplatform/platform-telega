export type ScheduleStatus = "pending" | "scheduled" | "in_progress" | "completed" | "overdue" | "blocked";

export interface ScheduleWindow {
  startAt: number;
  endAt: number;
  durationMs: number;
}

export interface ScheduleDependency {
  fromId: string;
  fromType: "phase" | "milestone" | "goal";
  toId: string;
  toType: "phase" | "milestone" | "goal";
  type: "blocks" | "requires" | "triggers";
}

export interface ScheduleConflict {
  type: "overlap" | "dependency_cycle" | "deadline_miss" | "resource_exhaustion";
  description: string;
  items: string[];
  severity: "warning" | "critical";
}

export interface ScheduleMilestone {
  milestoneId: string;
  title: string;
  deadline: number | null;
  plannedWindow: ScheduleWindow | null;
  actualWindow: ScheduleWindow | null;
  status: ScheduleStatus;
  dependencies: string[];
}

export interface SchedulePhase {
  phaseId: string;
  title: string;
  order: number;
  milestones: ScheduleMilestone[];
  plannedWindow: ScheduleWindow | null;
  actualWindow: ScheduleWindow | null;
  status: ScheduleStatus;
}

export interface SchedulePlan {
  planId: string;
  horizonPlanId: string;
  phases: SchedulePhase[];
  dependencies: ScheduleDependency[];
  conflicts: ScheduleConflict[];
  status: ScheduleStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ScheduleTimeline {
  planId: string;
  totalDurationMs: number;
  phases: Array<{
    name: string;
    startAt: number;
    endAt: number;
    status: string;
    milestones: Array<{ name: string; deadline: number | null; status: string }>;
  }>;
  blockers: string[];
  conflicts: ScheduleConflict[];
}
