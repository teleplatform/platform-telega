export type SpaceStatus = "active" | "paused" | "archived";

export type ContextVisibility = "creator" | "team" | "public";

export type ContextType = "mission" | "repo" | "doc" | "memory" | "evidence" | "artifact";

export interface SpaceContextRef {
  id: string;
  type: ContextType;
  title: string;
  ref: string;
  visibility: ContextVisibility;
}

export interface Space {
  id: string;
  name: string;
  description: string;
  status: SpaceStatus;
  agentIds: string[];
  taskIds: string[];
  contextRefs: SpaceContextRef[];
  evidenceRefs: string[];
  missionId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SpaceSummary {
  id: string;
  name: string;
  status: SpaceStatus;
  agentCount: number;
  taskCount: number;
  contextCount: number;
  evidenceCount: number;
}
