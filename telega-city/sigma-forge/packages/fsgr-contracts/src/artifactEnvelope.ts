import type { ArtifactKind, ValidatorStatus } from "./skillUnit.js";

export interface ArtifactEnvelope {
  artifact_id: string;
  run_id: string;
  node_id?: string;
  artifact_kind: ArtifactKind;
  title: string;
  storage_ref: string;
  checksum?: string;
  validator_results: Array<{
    validator: string;
    status: ValidatorStatus;
    summary: string;
  }>;
  created_at: string;
}
