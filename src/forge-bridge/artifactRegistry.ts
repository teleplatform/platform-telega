/**
 * Artifact Registry — In-memory artifact store
 *
 * Artifacts must be registered here BEFORE they can be used through the pipeline API.
 * This is the missing link between artifact creation and pipeline operations.
 */

export interface ArtifactRecord {
  id: string;
  type: string;
  title: string;
  goal: string;
  target: string;
  createdAt: string;
  summary: string;
  payload: Record<string, unknown>;
}

export interface ArtifactRegistryEntry {
  artifact: ArtifactRecord;
  taskId: string;
  traceId: string;
  registeredAt: number;
}

const _artifactRegistry = new Map<string, ArtifactRegistryEntry>();

export function registerArtifact(input: {
  artifact: ArtifactRecord;
  taskId: string;
  traceId: string;
}): void {
  _artifactRegistry.set(input.artifact.id, {
    artifact: input.artifact,
    taskId: input.taskId,
    traceId: input.traceId,
    registeredAt: Date.now(),
  });
}

export function getArtifact(artifactId: string): ArtifactRegistryEntry | undefined {
  return _artifactRegistry.get(artifactId);
}

export function listArtifacts(): ArtifactRegistryEntry[] {
  return Array.from(_artifactRegistry.values());
}

export function clearArtifactRegistry(): void {
  _artifactRegistry.clear();
}

export function setArtifactRegistryForTest(entries: Map<string, ArtifactRegistryEntry>): void {
  _artifactRegistry.clear();
  if (entries) {
    entries.forEach((v, k) => _artifactRegistry.set(k, v));
  }
}
