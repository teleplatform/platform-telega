import { GoalDecompositionResult, DecomposedGoal, DOMAIN_TEMPLATES, DEPLOY_AGENTS } from "./decompositionTypes";

const MAX_GOALS = 7;

export function decomposeMission(mission: string): GoalDecompositionResult {
  const lower = mission.toLowerCase();
  let goals: DecomposedGoal[];

  // Detect domain from mission text
  if (lower.includes("crm") || lower.includes("client") || lower.includes("booking")) {
    goals = DOMAIN_TEMPLATES.crm;
  } else if (lower.includes("api") || lower.includes("rest") || lower.includes("endpoint")) {
    goals = DOMAIN_TEMPLATES.api;
  } else if (lower.includes("web") || lower.includes("app") || lower.includes("ui") || lower.includes("front")) {
    goals = DOMAIN_TEMPLATES.webapp;
  } else {
    goals = DOMAIN_TEMPLATES.default;
  }

  // Trim to max
  if (goals.length > MAX_GOALS) {
    goals = goals.slice(0, MAX_GOALS);
  }

  // Count priorities
  const criticalCount = goals.filter((g) => g.priority === "critical").length;
  const highCount = goals.filter((g) => g.priority === "high").length;
  const mediumCount = goals.filter((g) => g.priority === "medium").length;
  const lowCount = goals.filter((g) => g.priority === "low").length;

  return {
    mission,
    goals,
    totalGoals: goals.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
  };
}

export function enrichDecomposition(
  mission: string,
  customGoals: Omit<DecomposedGoal, "priority" | "dependsOn" | "suggestedAgent" | "estimatedEffort">[]
): GoalDecompositionResult {
  const goals: DecomposedGoal[] = customGoals.slice(0, MAX_GOALS).map((g, i) => {
    const lower = g.title.toLowerCase();
    let priority: DecomposedGoal["priority"] = "medium";
    if (i === 0 || lower.includes("schema") || lower.includes("architect") || lower.includes("plan")) priority = "critical";
    else if (lower.includes("test") || lower.includes("verify") || lower.includes("deploy")) priority = "critical";
    else if (lower.includes("implement") || lower.includes("build") || lower.includes("create")) priority = "high";

    // Detect agent from keywords
    const agentKey = Object.keys(DEPLOY_AGENTS).find((k) => lower.includes(k));
    const suggestedAgent = agentKey
      ? DEPLOY_AGENTS[agentKey]
      : "coder";

    // Infer dependencies
    const dependsOn: string[] = [];
    if (i > 0) dependsOn.push(customGoals[i - 1].title);

    return {
      title: g.title,
      description: g.description || "",
      priority,
      dependsOn,
      suggestedAgent: suggestedAgent as any,
      estimatedEffort: "medium",
    };
  });

  const criticalCount = goals.filter((g) => g.priority === "critical").length;
  const highCount = goals.filter((g) => g.priority === "high").length;
  const mediumCount = goals.filter((g) => g.priority === "medium").length;
  const lowCount = goals.filter((g) => g.priority === "low").length;

  return { mission, goals, totalGoals: goals.length, criticalCount, highCount, mediumCount, lowCount };
}
