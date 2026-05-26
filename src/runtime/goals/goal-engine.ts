import type { RuntimeGoal, GoalStep } from "./goal-types.js";
import { createGoal } from "./goal-types.js";
import { addGoal, getAllGoals, updateGoal, getGoal } from "./goal-store.js";
import { recordOperation } from "../memory/operational-memory.js";

export function createAndStoreGoal(params: {
  title: string;
  description: string;
  priority?: "critical" | "high" | "medium" | "low";
  creatorId?: string;
  steps?: GoalStep[];
}): RuntimeGoal {
  const goal = createGoal({ ...params, category: "mission" });
  addGoal(goal);
  recordOperation("goal_created", `${goal.title} (${goal.priority})`);
  return goal;
}

export function advanceGoal(goalId: string, progress: number, nextStep: string): RuntimeGoal | undefined {
  const goal = getGoal(goalId);
  if (!goal) return undefined;
  const updated = updateGoal(goalId, { progress: Math.min(100, progress), nextStep });
  if (updated) {
    recordOperation("goal_advanced", `${updated.title} → ${progress}%`);
  }
  return updated;
}

export function completeGoal(goalId: string): RuntimeGoal | undefined {
  const goal = getGoal(goalId);
  if (!goal) return undefined;
  const updated = updateGoal(goalId, { status: "completed", progress: 100, nextStep: "done" });
  if (updated) {
    recordOperation("goal_completed", updated.title);
  }
  return updated;
}

export function failGoal(goalId: string, reason: string): RuntimeGoal | undefined {
  const goal = getGoal(goalId);
  if (!goal) return undefined;
  const updated = updateGoal(goalId, { status: "failed", evidence: [...goal.evidence, `failed: ${reason}`] });
  if (updated) {
    recordOperation("goal_failed", `${updated.title}: ${reason}`);
  }
  return updated;
}

export function pauseGoal(goalId: string): RuntimeGoal | undefined {
  const goal = getGoal(goalId);
  if (!goal) return undefined;
  const updated = updateGoal(goalId, { status: "paused" });
  if (updated) {
    recordOperation("goal_paused", updated.title);
  }
  return updated;
}

export function resumeGoal(goalId: string): RuntimeGoal | undefined {
  const goal = getGoal(goalId);
  if (!goal) return undefined;
  const updated = updateGoal(goalId, { status: "active" });
  if (updated) {
    recordOperation("goal_resumed", updated.title);
  }
  return updated;
}

export function markStepDone(goalId: string, stepId: string): RuntimeGoal | undefined {
  const goal = getGoal(goalId);
  if (!goal) return undefined;
  const steps = goal.steps.map(s =>
    s.id === stepId ? { ...s, status: "done" as const } : s
  );
  const doneCount = steps.filter(s => s.status === "done").length;
  const progress = Math.round((doneCount / steps.length) * 100);
  const nextPending = steps.find(s => s.status === "pending");
  return updateGoal(goalId, {
    steps,
    progress,
    nextStep: nextPending?.description || "all done",
  });
}

export function getGoalInventory(): string {
  const all = getAllGoals();
  if (all.length === 0) return "No goals in inventory.";

  const lines: string[] = ["=== GOAL INVENTORY ==="];
  for (const g of all) {
    const age = Math.round((Date.now() - g.createdAt) / (1000 * 60));
    lines.push(
      `[${g.status}] ${g.priority.toUpperCase()} ${g.title} — ${g.progress}% — ${age}m ago — next: ${g.nextStep}`
    );
  }
  return lines.join("\n");
}
