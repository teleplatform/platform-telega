import { DecomposedGoal, DecomposedGoalPriority } from "./decompositionTypes";

export function prioritizeGoals(goals: DecomposedGoal[]): DecomposedGoal[] {
  const priorityWeight: Record<DecomposedGoalPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  // Topological sort: goals with no deps first, then resolved deps
  const sorted: DecomposedGoal[] = [];
  const remaining = [...goals];
  const resolved = new Set<string>();

  while (remaining.length > 0) {
    const ready = remaining.filter(
      (g) => g.dependsOn.every((d) => resolved.has(d)) || g.dependsOn.length === 0
    );
    if (ready.length === 0) break;

    // Sort ready by priority (highest first)
    ready.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    for (const g of ready) {
      sorted.push(g);
      resolved.add(g.title);
      const idx = remaining.findIndex((r) => r.title === g.title);
      if (idx >= 0) remaining.splice(idx, 1);
    }
  }

  // Add any remaining (circular deps)
  sorted.push(...remaining);

  return sorted;
}
