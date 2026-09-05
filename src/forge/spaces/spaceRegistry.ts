import { Space, SpaceContextRef, ContextType, ContextVisibility, SpaceStatus, SpaceSummary } from "./spaceTypes";

const spaces = new Map<string, Space>();

let counter = 0;
function genId(): string {
  counter++;
  return `space_${Date.now()}_${counter}`;
}

export const SpaceRegistry = {
  create(name: string, description: string, missionId?: string): Space {
    const now = Date.now();
    const space: Space = {
      id: genId(),
      name,
      description,
      status: "active",
      agentIds: [],
      taskIds: [],
      contextRefs: [],
      evidenceRefs: [],
      missionId: missionId || null,
      createdAt: now,
      updatedAt: now,
    };
    spaces.set(space.id, space);
    return space;
  },

  get(id: string): Space | undefined {
    return spaces.get(id);
  },

  getAll(): Space[] {
    return Array.from(spaces.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  update(id: string, updates: Partial<Space>): Space | null {
    const existing = spaces.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    spaces.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return spaces.delete(id);
  },

  addAgent(spaceId: string, agentId: string): Space | null {
    const space = spaces.get(spaceId);
    if (!space) return null;
    if (!space.agentIds.includes(agentId)) space.agentIds.push(agentId);
    return this.update(spaceId, { agentIds: space.agentIds });
  },

  addTask(spaceId: string, taskId: string): Space | null {
    const space = spaces.get(spaceId);
    if (!space) return null;
    if (!space.taskIds.includes(taskId)) space.taskIds.push(taskId);
    return this.update(spaceId, { taskIds: space.taskIds });
  },

  addContextRef(spaceId: string, ref: SpaceContextRef): Space | null {
    const space = spaces.get(spaceId);
    if (!space) return null;
    space.contextRefs.push(ref);
    return this.update(spaceId, { contextRefs: space.contextRefs });
  },

  addEvidenceRef(spaceId: string, evidenceId: string): Space | null {
    const space = spaces.get(spaceId);
    if (!space) return null;
    if (!space.evidenceRefs.includes(evidenceId)) space.evidenceRefs.push(evidenceId);
    return this.update(spaceId, { evidenceRefs: space.evidenceRefs });
  },

  setStatus(spaceId: string, status: SpaceStatus): Space | null {
    return this.update(spaceId, { status });
  },

  getSummary(spaceId: string): SpaceSummary | null {
    const space = spaces.get(spaceId);
    if (!space) return null;
    return {
      id: space.id,
      name: space.name,
      status: space.status,
      agentCount: space.agentIds.length,
      taskCount: space.taskIds.length,
      contextCount: space.contextRefs.length,
      evidenceCount: space.evidenceRefs.length,
    };
  },

  getAllSummaries(): SpaceSummary[] {
    return this.getAll().map((s) => this.getSummary(s.id)!);
  },

  size(): number {
    return spaces.size;
  },
};
