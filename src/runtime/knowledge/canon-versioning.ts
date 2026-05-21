import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getCanon, type CanonEntry } from "./strategic-canon-registry.js";

export interface CanonVersion {
  version_id: string;
  canon_id: string;
  version: number;
  status_before: CanonEntry["status"];
  status_after: CanonEntry["status"];
  created_at: string;
}

let versionCounter = 0;

export async function createCanonVersion(canonId: string): Promise<CanonVersion | null> {
  const entry = getCanon(canonId);
  if (!entry) return null;

  versionCounter++;
  const statusBefore = entry.status;

  const version: CanonVersion = {
    version_id: `cv_${Date.now()}_${versionCounter}`,
    canon_id: canonId,
    version: entry.version + 1,
    status_before: statusBefore,
    status_after: entry.status,
    created_at: new Date().toISOString(),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(version.version_id, "canon_version_created"),
    trace_id: version.version_id,
    job_id: "knowledge",
    type: "canon_version_created",
    timestamp: version.created_at,
    payload: {
      version_id: version.version_id,
      canon_id: canonId,
      version: version.version,
    },
  });

  return version;
}

export async function supersedeCanon(canonId: string, replacementId: string): Promise<CanonEntry | null> {
  const entry = getCanon(canonId);
  if (!entry) return null;

  entry.status = "superseded";
  entry.updated_at = new Date().toISOString();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${canonId}_superseded`, "canon_superseded"),
    trace_id: canonId,
    job_id: "knowledge",
    type: "canon_superseded",
    timestamp: entry.updated_at,
    payload: { canon_id: canonId, replaced_by: replacementId },
  });

  return entry;
}

export async function archiveCanon(canonId: string): Promise<CanonEntry | null> {
  const entry = getCanon(canonId);
  if (!entry) return null;

  entry.status = "archived";
  entry.updated_at = new Date().toISOString();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${canonId}_archived`, "canon_archived"),
    trace_id: canonId,
    job_id: "knowledge",
    type: "canon_archived",
    timestamp: entry.updated_at,
    payload: { canon_id: canonId },
  });

  return entry;
}
