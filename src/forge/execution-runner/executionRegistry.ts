import { ExecutionRun, RunStatus } from "./executionTypes";

const runs = new Map<string, ExecutionRun>();

let counter = 0;
function genId(): string {
  counter++;
  return `run_${Date.now()}_${counter}`;
}

export const ExecutionRegistry = {
  create(taskId: string, graphId: string, agentId?: string, providerId?: string): ExecutionRun {
    const now = Date.now();
    const run: ExecutionRun = {
      id: genId(),
      taskId,
      graphId,
      agentId: agentId || null,
      providerId: providerId || null,
      status: "queued",
      evidenceRefs: [],
      result: null,
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
    };
    runs.set(run.id, run);
    return run;
  },

  get(id: string): ExecutionRun | undefined {
    return runs.get(id);
  },

  getAll(): ExecutionRun[] {
    return Array.from(runs.values()).sort((a, b) => b.createdAt - a.createdAt);
  },

  update(id: string, updates: Partial<ExecutionRun>): ExecutionRun | null {
    const existing = runs.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id };
    runs.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return runs.delete(id);
  },

  listByTask(taskId: string): ExecutionRun[] {
    return Array.from(runs.values()).filter((r) => r.taskId === taskId);
  },

  listByGraph(graphId: string): ExecutionRun[] {
    return Array.from(runs.values()).filter((r) => r.graphId === graphId);
  },

  listByStatus(status: RunStatus): ExecutionRun[] {
    return Array.from(runs.values()).filter((r) => r.status === status);
  },

  addEvidence(runId: string, evidenceRef: string): ExecutionRun | null {
    const run = runs.get(runId);
    if (!run) return null;
    if (!run.evidenceRefs.includes(evidenceRef)) run.evidenceRefs.push(evidenceRef);
    return this.update(runId, { evidenceRefs: run.evidenceRefs });
  },

  size(): number {
    return runs.size;
  },
};
