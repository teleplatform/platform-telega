import type Database from "better-sqlite3";

export function createArtifactsRepo(db: Database.Database) {
  return {
    createArtifact(artifact: { artifact_id: string; run_id: string; node_id?: string; artifact_kind: string; title: string; storage_ref: string; checksum?: string; validator_results: any[] }): void {
      db.prepare(
        `INSERT INTO fsgr_artifacts (artifact_id, run_id, node_id, artifact_kind, title, storage_ref, checksum, validator_results_json, created_at)
         VALUES (@artifact_id, @run_id, @node_id, @artifact_kind, @title, @storage_ref, @checksum, @validator_results_json, @created_at)`
      ).run({
        artifact_id: artifact.artifact_id,
        run_id: artifact.run_id,
        node_id: artifact.node_id ?? null,
        artifact_kind: artifact.artifact_kind,
        title: artifact.title,
        storage_ref: artifact.storage_ref,
        checksum: artifact.checksum ?? null,
        validator_results_json: JSON.stringify(artifact.validator_results),
        created_at: new Date().toISOString(),
      });
    },

    getArtifactsByRunId(run_id: string): any[] {
      return db.prepare("SELECT * FROM fsgr_artifacts WHERE run_id = ?").all(run_id);
    },
  };
}
