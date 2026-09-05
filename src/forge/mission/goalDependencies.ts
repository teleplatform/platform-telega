import { DecomposedGoal } from "./decompositionTypes";

export function buildGoalDependencies(goals: DecomposedGoal[]): DecomposedGoal[] {
  // Already has dependsOn from decomposition — ensure consistency
  const titles = new Set(goals.map((g) => g.title));

  for (const goal of goals) {
    goal.dependsOn = goal.dependsOn.filter((d) => titles.has(d));
  }

  return goals;
}

export function validateDependencies(goals: DecomposedGoal[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const titles = new Set(goals.map((g) => g.title));

  for (const goal of goals) {
    for (const dep of goal.dependsOn) {
      if (!titles.has(dep)) {
        errors.push(`Goal "${goal.title}" depends on "${dep}" which does not exist`);
      }
    }
  }

  // Check for circular dependencies
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function hasCycle(title: string, chain: string[]): boolean {
    if (inStack.has(title)) {
      const cycleStart = chain.indexOf(title);
      const cycle = chain.slice(cycleStart).concat(title).join(" → ");
      errors.push(`Circular dependency detected: ${cycle}`);
      return true;
    }
    if (visited.has(title)) return false;

    visited.add(title);
    inStack.add(title);
    chain.push(title);

    const goal = goals.find((g) => g.title === title);
    if (goal) {
      for (const dep of goal.dependsOn) {
        if (hasCycle(dep, [...chain])) return true;
      }
    }

    inStack.delete(title);
    return false;
  }

  for (const goal of goals) {
    hasCycle(goal.title, []);
  }

  return { valid: errors.length === 0, errors };
}
