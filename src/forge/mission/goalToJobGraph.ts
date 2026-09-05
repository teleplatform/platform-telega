import { DecomposedGoal, SuggestedAgent } from "./decompositionTypes";
import { MissionRegistry } from "./missionRegistry";

const ROLE_MAP: Record<SuggestedAgent, string> = {
  planner: "planner",
  coder: "coder",
  designer: "coder",
  tester: "tester",
  verifier: "verifier",
  researcher: "researcher",
};

export function applyDecompositionToMission(
  missionId: string,
  goals: DecomposedGoal[]
): { ok: boolean; created: number; errors: string[] } {
  const mission = MissionRegistry.get(missionId);
  if (!mission) return { ok: false, created: 0, errors: ["Mission not found"] };

  const errors: string[] = [];
  let created = 0;

  for (const goal of goals) {
    const result = MissionRegistry.addGoal(missionId, goal.title, goal.description);
    if (result) {
      created++;
    } else {
      errors.push(`Failed to add goal: ${goal.title}`);
    }
  }

  return { ok: errors.length === 0, created, errors };
}

export function goalsToJobNodes(goals: DecomposedGoal[]): Array<{
  title: string;
  description: string;
  agentId: string;
  dependsOn: string[];
}> {
  // Map goal titles to indices for dependsOn resolution
  const titleToIndex = new Map<string, number>();
  goals.forEach((g, i) => titleToIndex.set(g.title, i));

  return goals.map((goal, i) => {
    // Convert title-based dependsOn to index-based
    const depIndices = goal.dependsOn
      .map((d) => titleToIndex.get(d))
      .filter((idx): idx is number => idx !== undefined)
      .map((idx) => String(idx));

    return {
      title: goal.title,
      description: goal.description,
      agentId: ROLE_MAP[goal.suggestedAgent] || "coder",
      dependsOn: depIndices,
    };
  });
}
