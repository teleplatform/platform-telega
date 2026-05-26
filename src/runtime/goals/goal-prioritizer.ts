import { getAllGoals, getActiveGoals } from "./goal-store.js";
import type { RuntimeGoal } from "./goal-types.js";

export interface PrioritizedGoal {
  goal: RuntimeGoal;
  urgencyScore: number;
  reason: string;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 100,
  high: 60,
  medium: 30,
  low: 10,
};

export function prioritizeGoals(): PrioritizedGoal[] {
  const active = getActiveGoals();
  const now = Date.now();

  const scored: PrioritizedGoal[] = active.map(goal => {
    let score = PRIORITY_WEIGHT[goal.priority] || 0;

    const hoursSinceUpdate = (now - goal.updatedAt) / (1000 * 60 * 60);
    if (hoursSinceUpdate > 48) score -= 30;
    else if (hoursSinceUpdate > 24) score -= 10;

    if (goal.deadline) {
      const hoursToDeadline = (goal.deadline - now) / (1000 * 60 * 60);
      if (hoursToDeadline < 0) score -= 50;
      else if (hoursToDeadline < 24) score += 40;
      else if (hoursToDeadline < 72) score += 20;
    }

    if (goal.progress > 80) score += 15;
    else if (goal.progress > 50) score += 10;
    else if (goal.progress < 10) score += 5;

    const reasons: string[] = [];
    if (goal.priority === "critical") reasons.push("critical priority");
    if (goal.deadline && (goal.deadline - now) / (1000 * 60 * 60) < 24) reasons.push("deadline within 24h");
    if (goal.progress > 80) reasons.push("near completion");

    return {
      goal,
      urgencyScore: score,
      reason: reasons.join(", ") || "routine",
    };
  });

  return scored.sort((a, b) => b.urgencyScore - a.urgencyScore);
}

export function getAbandonedAlert(): string {
  const all = getAllGoals();
  const stale = all.filter(g =>
    g.status === "active" && (Date.now() - g.updatedAt) / (1000 * 60 * 60) > 72
  );
  if (stale.length === 0) return "";

  const lines = stale.map(g =>
    `⚠️ ${g.title} — ${Math.round((Date.now() - g.updatedAt) / (1000 * 60 * 60))}h without update`
  );
  return ["=== ABANDONED GOALS ===", ...lines].join("\n");
}

export function getWhatMatters(): string {
  const prioritized = prioritizeGoals();
  if (prioritized.length === 0) return "No active goals.";

  const lines: string[] = ["=== WHAT MATTERS MOST ==="];
  for (const p of prioritized.slice(0, 5)) {
    lines.push(`  [${p.urgencyScore}] ${p.goal.priority.toUpperCase()} ${p.goal.title} — ${p.goal.progress}% — ${p.reason}`);
  }
  return lines.join("\n");
}
