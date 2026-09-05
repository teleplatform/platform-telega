import { Mission, MissionGoal, MissionProgress, MissionSummary } from "./missionTypes";
import { JobRegistry } from "../job/index.js";

const missions = new Map<string, Mission>();

let counter = 0;
function genId(): string {
  counter++;
  return `mission_${Date.now()}_${counter}`;
}

export const MissionRegistry = {
  create(title: string, description: string, priority: Mission["priority"], tags: string[]): Mission {
    const now = Date.now();
    const mission: Mission = {
      id: genId(),
      title,
      description,
      status: "draft",
      priority,
      goals: [],
      graphIds: [],
      capsuleIds: [],
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      tags,
    };
    missions.set(mission.id, mission);
    return mission;
  },

  get(id: string): Mission | undefined {
    return missions.get(id);
  },

  getAll(): Mission[] {
    return Array.from(missions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  update(id: string, updates: Partial<Mission>): Mission | null {
    const existing = missions.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    missions.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return missions.delete(id);
  },

  addGoal(missionId: string, title: string, description: string): MissionGoal | null {
    const mission = missions.get(missionId);
    if (!mission) return null;
    const goal: MissionGoal = {
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      description,
      status: "pending",
      graphId: null,
    };
    mission.goals.push(goal);
    this.update(missionId, { goals: mission.goals });
    return goal;
  },

  updateGoal(missionId: string, goalId: string, updates: Partial<MissionGoal>): Mission | null {
    const mission = missions.get(missionId);
    if (!mission) return null;
    const idx = mission.goals.findIndex((g) => g.id === goalId);
    if (idx === -1) return null;
    mission.goals[idx] = { ...mission.goals[idx], ...updates, id: goalId };
    return this.update(missionId, { goals: mission.goals });
  },

  linkGraph(missionId: string, graphId: string): Mission | null {
    const mission = missions.get(missionId);
    if (!mission) return null;
    if (!mission.graphIds.includes(graphId)) {
      mission.graphIds.push(graphId);
    }
    return this.update(missionId, { graphIds: mission.graphIds });
  },

  linkCapsule(missionId: string, capsuleId: string): Mission | null {
    const mission = missions.get(missionId);
    if (!mission) return null;
    if (!mission.capsuleIds.includes(capsuleId)) {
      mission.capsuleIds.push(capsuleId);
    }
    return this.update(missionId, { capsuleIds: mission.capsuleIds });
  },

  getProgress(id: string): MissionProgress | null {
    const mission = missions.get(id);
    if (!mission) return null;

    const totalGoals = mission.goals.length;
    const completedGoals = mission.goals.filter((g) => g.status === "completed").length;
    const failedGoals = mission.goals.filter((g) => g.status === "failed").length;
    const activeGoals = mission.goals.filter((g) => g.status === "active" || g.status === "pending").length;

    let completedGraphs = 0;
    for (const gId of mission.graphIds) {
      const graph = JobRegistry.get(gId);
      if (graph?.status === "completed") completedGraphs++;
    }

    const durationMs = mission.startedAt && mission.completedAt
      ? mission.completedAt - mission.startedAt
      : mission.startedAt
      ? Date.now() - mission.startedAt
      : null;

    return {
      totalGoals,
      completedGoals,
      failedGoals,
      activeGoals,
      totalGraphs: mission.graphIds.length,
      completedGraphs,
      totalCapsules: mission.capsuleIds.length,
      durationMs,
    };
  },

  getSummary(id: string): MissionSummary | null {
    const mission = missions.get(id);
    if (!mission) return null;
    const progress = this.getProgress(id);
    return {
      id: mission.id,
      title: mission.title,
      status: mission.status,
      priority: mission.priority,
      goalCount: mission.goals.length,
      completedGoals: progress?.completedGoals || 0,
      graphCount: mission.graphIds.length,
      capsuleCount: mission.capsuleIds.length,
      createdAt: mission.createdAt,
    };
  },

  size(): number {
    return missions.size;
  },
};
