import { loadGoals, getActiveGoals, updateGoal, getAllGoals } from "./goal-store.js";
import { recordRuntimeEvent } from "../memory/operational-memory.js";

export interface RecoveryReport {
  recovered: number;
  stale: number;
  abandoned: number;
  total: number;
  details: string[];
}

export function recoverGoals(): RecoveryReport {
  loadGoals();
  const all = getAllGoals();
  const active = getActiveGoals();
  const now = Date.now();
  const details: string[] = [];
  let recovered = 0;
  let stale = 0;
  let abandoned = 0;

  for (const goal of active) {
    const hoursSinceUpdate = (now - goal.updatedAt) / (1000 * 60 * 60);

    if (hoursSinceUpdate > 72) {
      updateGoal(goal.id, { status: "abandoned" });
      abandoned++;
      details.push(`[abandoned] ${goal.title} — no update for ${Math.round(hoursSinceUpdate)}h`);
      continue;
    }

    if (hoursSinceUpdate > 24) {
      stale++;
      details.push(`[stale] ${goal.title} — no update for ${Math.round(hoursSinceUpdate)}h`);
    }

    if (goal.status === "active") {
      updateGoal(goal.id, { evidence: [...goal.evidence, `recovered: ${new Date(now).toISOString()}`] });
      recovered++;
      details.push(`[recovered] ${goal.title} — ${goal.progress}% complete, next: ${goal.nextStep}`);
    }
  }

  recordRuntimeEvent("goal_recovery", `recovered=${recovered} stale=${stale} abandoned=${abandoned}`);

  return { recovered, stale, abandoned, total: all.length, details };
}

export function getUnfinishedBusiness(): string {
  const active = getActiveGoals();
  if (active.length === 0) return "No unfinished business.";

  const lines: string[] = ["=== UNFINISHED BUSINESS ==="];
  for (const g of active) {
    const age = Math.round((Date.now() - g.createdAt) / (1000 * 60 * 60));
    lines.push(`  [${g.priority}] ${g.title} — ${g.progress}% — ${age}h old — next: ${g.nextStep}`);
  }
  return lines.join("\n");
}
