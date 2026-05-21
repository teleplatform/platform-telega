import fs from "node:fs";
import crypto from "node:crypto";
import { getEvidenceByTrace, appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface ArtifactIntegrityResult {
  trace_id: string;
  total_artifacts: number;
  checked: number;
  passed: number;
  failed: number;
  missing: number;
  results: ArtifactCheckResult[];
}

export interface ArtifactCheckResult {
  artifact_path: string;
  exists: boolean;
  stored_hash?: string;
  computed_hash?: string;
  match?: boolean;
  error?: string;
}

function sha256File(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function verifyArtifactIntegrity(
  artifactPath: string,
  storedHash?: string,
): ArtifactCheckResult {
  if (!fs.existsSync(artifactPath)) {
    return {
      artifact_path: artifactPath,
      exists: false,
      stored_hash: storedHash,
      error: "file_not_found",
    };
  }

  try {
    const computedHash = sha256File(artifactPath);
    const match = storedHash ? computedHash === storedHash : undefined;
    return {
      artifact_path: artifactPath,
      exists: true,
      stored_hash: storedHash,
      computed_hash: computedHash,
      match,
    };
  } catch (e: any) {
    return {
      artifact_path: artifactPath,
      exists: true,
      stored_hash: storedHash,
      error: e.message,
    };
  }
}

export async function verifyTraceArtifacts(traceId: string): Promise<ArtifactIntegrityResult> {
  const records = getEvidenceByTrace(traceId);

  const artifactEntries = records
    .filter((r) => r.artifact_ids && r.artifact_ids.length > 0)
    .flatMap((r) =>
      (r.artifact_ids || []).map((id) => ({
        path: id,
        hash: r.output_hash,
      })),
    );

  const seen = new Set<string>();
  const results: ArtifactCheckResult[] = [];
  let missing = 0;

  for (const entry of artifactEntries) {
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);

    const result = verifyArtifactIntegrity(entry.path, entry.hash);
    results.push(result);

    if (!result.exists) missing++;
  }

  const passed = results.filter((r) => r.match === true).length;
  const failed = results.filter((r) => r.match === false).length;

  const evidenceType: "artifact_integrity_checked" | "artifact_integrity_failed" =
    failed > 0 || missing > 0 ? "artifact_integrity_failed" : "artifact_integrity_checked";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, evidenceType),
    trace_id: traceId,
    job_id: traceId,
    type: evidenceType,
    timestamp: new Date().toISOString(),
    payload: {
      total_artifacts: artifactEntries.length,
      checked: results.length,
      passed,
      failed,
      missing,
      results: results.map((r) => ({
        artifact_path: r.artifact_path,
        exists: r.exists,
        match: r.match,
        error: r.error,
      })),
    },
  });

  return {
    trace_id: traceId,
    total_artifacts: artifactEntries.length,
    checked: results.length,
    passed,
    failed,
    missing,
    results,
  };
}
