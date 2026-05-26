export type GoalStatus = "active" | "paused" | "completed" | "abandoned" | "failed";
export type GoalPriority = "critical" | "high" | "medium" | "low";
export type GoalCategory = "operational" | "mission" | "maintenance" | "learning" | "user_request";

export interface GoalStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "done" | "failed";
  order: number;
}

export interface RuntimeGoal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  status: GoalStatus;
  priority: GoalPriority;
  progress: number;
  steps: GoalStep[];
  nextStep: string;
  creatorId: string;
  createdAt: number;
  updatedAt: number;
  deadline?: number;
  tags: string[];
  evidence: string[];
}

export function createGoal(params: {
  title: string;
  description: string;
  category?: GoalCategory;
  priority?: GoalPriority;
  creatorId?: string;
  steps?: GoalStep[];
  deadline?: number;
  tags?: string[];
}): RuntimeGoal {
  return {
    id: `goal_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    title: params.title,
    description: params.description,
    category: params.category || "user_request",
    status: "active",
    priority: params.priority || "medium",
    progress: 0,
    steps: params.steps || [],
    nextStep: params.steps?.[0]?.description || "start",
    creatorId: params.creatorId || "unknown",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deadline: params.deadline,
    tags: params.tags || [],
    evidence: [],
  };
}

export function isGoalStale(goal: RuntimeGoal, hours = 24): boolean {
  if (goal.status === "completed" || goal.status === "abandoned" || goal.status === "failed") return false;
  const ageHours = (Date.now() - goal.updatedAt) / (1000 * 60 * 60);
  return ageHours > hours;
}

export function isGoalAbandoned(goal: RuntimeGoal): boolean {
  if (goal.status === "abandoned") return true;
  return isGoalStale(goal, 72);
}
