export type ArtifactType =
  | "report" | "patch" | "document" | "capsule"
  | "screenshot" | "output" | "plan" | "generated_file";

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  description: string;
  storageRef: string;
  sizeBytes: number;
  missionId: string | null;
  spaceId: string | null;
  taskId: string | null;
  executionRunId: string | null;
  evidenceRefs: string[];
  createdAt: number;
}

export interface ArtifactSummary {
  total: number;
  byType: Record<string, number>;
  totalSizeBytes: number;
}
