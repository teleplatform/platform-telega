import { Artifact, ArtifactType, ArtifactSummary } from "./artifactTypes";

const artifacts: Artifact[] = [];

let counter = 0;
function genId(): string {
  counter++;
  return `art_${Date.now()}_${counter}`;
}

export const ArtifactRegistry = {
  add(
    type: ArtifactType,
    title: string,
    description: string,
    storageRef: string,
    sizeBytes: number,
    bindings?: {
      missionId?: string;
      spaceId?: string;
      taskId?: string;
      executionRunId?: string;
    }
  ): Artifact {
    const artifact: Artifact = {
      id: genId(),
      type,
      title,
      description,
      storageRef,
      sizeBytes,
      missionId: bindings?.missionId || null,
      spaceId: bindings?.spaceId || null,
      taskId: bindings?.taskId || null,
      executionRunId: bindings?.executionRunId || null,
      evidenceRefs: [],
      createdAt: Date.now(),
    };
    artifacts.push(artifact);
    return artifact;
  },

  get(id: string): Artifact | undefined {
    return artifacts.find((a) => a.id === id);
  },

  getAll(): Artifact[] {
    return [...artifacts].sort((a, b) => b.createdAt - a.createdAt);
  },

  listByType(type: ArtifactType): Artifact[] {
    return artifacts.filter((a) => a.type === type);
  },

  listByMission(missionId: string): Artifact[] {
    return artifacts.filter((a) => a.missionId === missionId);
  },

  listBySpace(spaceId: string): Artifact[] {
    return artifacts.filter((a) => a.spaceId === spaceId);
  },

  listByTask(taskId: string): Artifact[] {
    return artifacts.filter((a) => a.taskId === taskId);
  },

  listByExecution(executionRunId: string): Artifact[] {
    return artifacts.filter((a) => a.executionRunId === executionRunId);
  },

  addEvidence(artifactId: string, evidenceRef: string): Artifact | null {
    const art = artifacts.find((a) => a.id === artifactId);
    if (!art) return null;
    if (!art.evidenceRefs.includes(evidenceRef)) art.evidenceRefs.push(evidenceRef);
    return art;
  },

  getSummary(): ArtifactSummary {
    const byType: Record<string, number> = {};
    let totalSizeBytes = 0;
    for (const a of artifacts) {
      byType[a.type] = (byType[a.type] || 0) + 1;
      totalSizeBytes += a.sizeBytes;
    }
    return { total: artifacts.length, byType, totalSizeBytes };
  },

  size(): number {
    return artifacts.length;
  },
};
