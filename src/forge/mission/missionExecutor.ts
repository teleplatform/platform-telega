import { Mission, MissionGoal } from "./missionTypes";
import { MissionRegistry } from "./missionRegistry";
import { JobRegistry, startGraph } from "../job/index.js";

export function activateMission(missionId: string): Mission | null {
  const mission = MissionRegistry.get(missionId);
  if (!mission || mission.status !== "draft") return null;

  // Set all goals to pending and mission to active
  const updatedGoals = mission.goals.map((g) => ({ ...g, status: "pending" as const }));
  return MissionRegistry.update(missionId, {
    status: "active",
    startedAt: Date.now(),
    goals: updatedGoals,
  });
}

export function completeMission(missionId: string): Mission | null {
  return MissionRegistry.update(missionId, {
    status: "completed",
    completedAt: Date.now(),
  });
}

export function failMission(missionId: string): Mission | null {
  return MissionRegistry.update(missionId, {
    status: "failed",
    completedAt: Date.now(),
  });
}

export function assignGraphToGoal(
  missionId: string,
  goalId: string,
  graphId: string
): Mission | null {
  const mission = MissionRegistry.get(missionId);
  if (!mission) return null;

  // Link graph to mission
  MissionRegistry.linkGraph(missionId, graphId);

  // Link graph to goal
  MissionRegistry.updateGoal(missionId, goalId, { graphId, status: "active" });

  // Start the graph
  startGraph(graphId);

  return MissionRegistry.get(missionId);
}

export function executeNextGoal(missionId: string): Mission | null {
  const mission = MissionRegistry.get(missionId);
  if (!mission || mission.status !== "active") return null;

  // Find first pending goal
  const nextGoal = mission.goals.find((g) => g.status === "pending");
  if (!nextGoal) {
    // All goals completed — complete mission
    return completeMission(missionId);
  }

  // Create a job graph for this goal
  const graph = JobRegistry.create(
    nextGoal.title,
    nextGoal.description,
    [
      {
        title: nextGoal.title,
        description: nextGoal.description,
        agentId: "coder",
        status: "pending" as const,
        priority: mission.priority as any,
        dependsOn: [],
        result: null,
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
        metadata: {},
      },
    ]
  );

  // Assign graph to goal and start
  return assignGraphToGoal(missionId, nextGoal.id, graph.id);
}
