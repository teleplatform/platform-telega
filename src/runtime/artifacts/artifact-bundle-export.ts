import fs from "node:fs";
import path from "node:path";
import { getEvidenceByTrace, readEvidenceRecords, appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { buildCompletionReport, renderCompletionReportText } from "../completion/completion-report-renderer.js";
import type { CompletionReport } from "../completion/completion-report-renderer.js";
import { checkFileOperationGovernance } from "../hooks/file-operation-governance-hook.js";

const BUNDLE_ROOT = path.join(process.cwd(), ".data", "artifact-bundles");

export interface ArtifactBundleManifest {
  trace_id: string;
  job_id: string;
  created_at: string;
  evidence_count: number;
  artifact_count: number;
  contains_completion_report: boolean;
  contains_evidence_summary: boolean;
  contains_verification: boolean;
  contains_rollback: boolean;
  files: string[];
}

function ensureBundleDir(traceId: string): string {
  const dir = path.join(BUNDLE_ROOT, traceId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

async function ensureWriteAllowed(filePath: string, traceId: string): Promise<void> {
  const gate = await checkFileOperationGovernance({
    kind: "export",
    path: filePath,
    trace_id: traceId,
    requested_by: "system",
    risk_hint: "low",
  });
  if (gate.decision === "blocked") {
    throw new Error(`artifact_export_blocked: ${gate.reason}`);
  }
  if (gate.decision === "requires_approval") {
    throw new Error(`artifact_export_requires_approval: ${gate.reason}`);
  }
}

export async function createArtifactBundle(traceId: string): Promise<{ ok: boolean; path?: string; manifest?: ArtifactBundleManifest; error?: string }> {
  const records = getEvidenceByTrace(traceId);
  if (records.length === 0) {
    return { ok: false, error: `trace not found: ${traceId}` };
  }

  const bundleDir = ensureBundleDir(traceId);
  const files: string[] = [];

  const jobId = records[0]?.job_id || traceId;

  const completionReport = buildCompletionReport(traceId);
  if (completionReport) {
    const reportPath = path.join(bundleDir, "completion-report.md");
    await ensureWriteAllowed(reportPath, traceId);
    fs.writeFileSync(reportPath, renderCompletionReportText(completionReport), "utf8");
    files.push("completion-report.md");

    const reportJsonPath = path.join(bundleDir, "completion-report.json");
    await ensureWriteAllowed(reportJsonPath, traceId);
    fs.writeFileSync(reportJsonPath, JSON.stringify(completionReport, null, 2), "utf8");
    files.push("completion-report.json");
  }

  const evidenceSummaryPath = path.join(bundleDir, "evidence-summary.json");
  await ensureWriteAllowed(evidenceSummaryPath, traceId);
  const evidenceTypes = new Map<string, number>();
  for (const r of records) {
    evidenceTypes.set(r.type, (evidenceTypes.get(r.type) || 0) + 1);
  }
  const evidenceSummary = {
    trace_id: traceId,
    total_records: records.length,
    types: Object.fromEntries(evidenceTypes),
    oldest: records[0]?.timestamp,
    newest: records[records.length - 1]?.timestamp,
  };
  fs.writeFileSync(evidenceSummaryPath, JSON.stringify(evidenceSummary, null, 2), "utf8");
  files.push("evidence-summary.json");

  const verificationRecords = records.filter(
    (r) => r.payload?.verification_result !== undefined,
  );
  if (verificationRecords.length > 0) {
    const verificationPath = path.join(bundleDir, "verification.json");
    fs.writeFileSync(verificationPath, JSON.stringify(verificationRecords, null, 2), "utf8");
    files.push("verification.json");
  }

  const rollbackRecords = records.filter(
    (r) => r.payload?.rollback_executed === true || r.payload?.rollback_plan !== undefined,
  );
  if (rollbackRecords.length > 0) {
    const rollbackPath = path.join(bundleDir, "rollback.json");
    fs.writeFileSync(rollbackPath, JSON.stringify(rollbackRecords, null, 2), "utf8");
    files.push("rollback.json");
  }

  const artifactPaths = records
    .filter((r) => r.artifact_ids && r.artifact_ids.length > 0)
    .flatMap((r) => r.artifact_ids || []);
  const artifactDir = path.join(bundleDir, "artifacts");
  if (artifactPaths.length > 0 && !fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
    for (const artifactPath of artifactPaths) {
      const fullPath = path.resolve(artifactPath);
      if (fs.existsSync(fullPath)) {
        const dest = path.join(artifactDir, path.basename(artifactPath));
        fs.copyFileSync(fullPath, dest);
        files.push(`artifacts/${path.basename(artifactPath)}`);
      }
    }
  }

  const manifest: ArtifactBundleManifest = {
    trace_id: traceId,
    job_id: jobId,
    created_at: new Date().toISOString(),
    evidence_count: records.length,
    artifact_count: artifactPaths.length,
    contains_completion_report: !!completionReport,
    contains_evidence_summary: true,
    contains_verification: verificationRecords.length > 0,
    contains_rollback: rollbackRecords.length > 0,
    files,
  };

  const manifestPath = path.join(bundleDir, "manifest.json");
  await ensureWriteAllowed(manifestPath, traceId);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  files.unshift("manifest.json");

  manifest.files = files;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "artifact_bundle_created"),
    trace_id: traceId,
    job_id: jobId,
    type: "artifact_bundle_created",
    timestamp: new Date().toISOString(),
    payload: {
      bundle_path: bundleDir,
      evidence_count: records.length,
      artifact_count: artifactPaths.length,
      files,
    },
  });

  return { ok: true, path: bundleDir, manifest };
}

export function getArtifactBundle(traceId: string): { ok: boolean; path?: string; manifest?: ArtifactBundleManifest; error?: string } {
  const bundleDir = path.join(BUNDLE_ROOT, traceId);
  const manifestPath = path.join(bundleDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return { ok: false, error: `no bundle found for trace: ${traceId}` };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ArtifactBundleManifest;
  return { ok: true, path: bundleDir, manifest };
}
