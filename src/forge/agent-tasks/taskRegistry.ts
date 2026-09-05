import { AgentTask, TaskStatus, TaskBinding, TaskDependency, TaskPriority, TaskSummary } from "./taskTypes";
import { JobRegistry, startGraph, completeJob, failJob as failGraphJob } from "../job/index.js";

const tasks = new Map<string, AgentTask>();

let counter = 0;
function genId(): string {
  counter++;
  return `atask_${Date.now()}_${counter}`;
}

export const TaskRegistry = {
  create(
    title: string,
    description: string,
    priority: TaskPriority,
    binding: Partial<TaskBinding>,
    dependsOn?: TaskDependency[]
  ): AgentTask {
    const now = Date.now();
    const task: AgentTask = {
      id: genId(),
      title,
      description,
      status: "pending",
      priority,
      binding: {
        agentId: binding.agentId || null,
        spaceId: binding.spaceId || null,
        missionId: binding.missionId || null,
        graphId: binding.graphId || null,
        sessionId: binding.sessionId || null,
      },
      dependsOn: dependsOn || [],
      evidenceRefs: [],
      result: null,
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    tasks.set(task.id, task);
    return task;
  },

  get(id: string): AgentTask | undefined {
    return tasks.get(id);
  },

  getAll(): AgentTask[] {
    return Array.from(tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  },

  update(id: string, updates: Partial<AgentTask>): AgentTask | null {
    const existing = tasks.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    tasks.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return tasks.delete(id);
  },

  listByAgent(agentId: string): AgentTask[] {
    return Array.from(tasks.values()).filter((t) => t.binding.agentId === agentId);
  },

  listBySpace(spaceId: string): AgentTask[] {
    return Array.from(tasks.values()).filter((t) => t.binding.spaceId === spaceId);
  },

  listByMission(missionId: string): AgentTask[] {
    return Array.from(tasks.values()).filter((t) => t.binding.missionId === missionId);
  },

  listByStatus(status: TaskStatus): AgentTask[] {
    return Array.from(tasks.values()).filter((t) => t.status === status);
  },

  addEvidence(taskId: string, evidenceRef: string): AgentTask | null {
    const task = tasks.get(taskId);
    if (!task) return null;
    if (!task.evidenceRefs.includes(evidenceRef)) task.evidenceRefs.push(evidenceRef);
    return this.update(taskId, { evidenceRefs: task.evidenceRefs });
  },

  async start(taskId: string): Promise<AgentTask | null> {
    const task = tasks.get(taskId);
    if (!task) return null;
    if (task.status !== "pending" && task.status !== "ready") return null;

    const now = Date.now();
    let updated = this.update(taskId, { status: "running", startedAt: now });
    if (!updated) return null;

    // If bound to a graph, create and start it via JobGraph
    return updated;
  },

  async complete(taskId: string, result?: string): Promise<AgentTask | null> {
    const task = tasks.get(taskId);
    if (!task) return null;
    if (task.status !== "running") return null;

    const now = Date.now();
    return this.update(taskId, {
      status: "completed",
      result: result || null,
      completedAt: now,
    });
  },

  async fail(taskId: string, error: string): Promise<AgentTask | null> {
    const task = tasks.get(taskId);
    if (!task) return null;
    if (task.status !== "running" && task.status !== "pending") return null;

    return this.update(taskId, {
      status: "failed",
      error,
      completedAt: Date.now(),
    });
  },

  cancel(taskId: string): AgentTask | null {
    const task = tasks.get(taskId);
    if (!task) return null;
    if (task.status === "completed") return null;
    return this.update(taskId, { status: "cancelled", completedAt: Date.now() });
  },

  getSummary(): TaskSummary {
    const all = Array.from(tasks.values());
    return {
      total: all.length,
      pending: all.filter((t) => t.status === "pending" || t.status === "ready").length,
      running: all.filter((t) => t.status === "running").length,
      completed: all.filter((t) => t.status === "completed").length,
      failed: all.filter((t) => t.status === "failed").length,
      blocked: all.filter((t) => t.status === "blocked").length,
    };
  },

  size(): number {
    return tasks.size;
  },
};
