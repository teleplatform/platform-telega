import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";
import { checkFileOperationGovernance } from "../hooks/file-operation-governance-hook.js";

const STORE_DIR = path.join(process.cwd(), ".data", "execution-evidence");
const EVIDENCE_FILE = "evidence.jsonl";
const EVIDENCE_PATH = path.join(STORE_DIR, EVIDENCE_FILE);
const ARCHIVE_DIR = path.join(STORE_DIR, "archive");
const ARCHIVE_SUBDIR = path.join(ARCHIVE_DIR, "evidence");

export interface RetentionSweepResult {
  archived: number;
  kept: number;
  total: number;
  archive_path: string;
}

export interface RetentionStatus {
  retention_days: number;
  archive_enabled: boolean;
  store_path: string;
  archive_path: string;
  total_records: number;
  last_archive?: string;
}

function getRetentionDays(): number {
  return Math.max(1, Number(process.env.EVIDENCE_RETENTION_DAYS) || 30);
}

function isArchiveEnabled(): boolean {
  return process.env.EVIDENCE_ARCHIVE_ENABLED !== "false";
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getEvidenceRetentionStatus(): RetentionStatus {
  const totalRecords = readEvidenceRecords().length;
  const archivePath = path.join(ARCHIVE_DIR, "evidence");

  let lastArchive: string | undefined;
  if (fs.existsSync(ARCHIVE_SUBDIR)) {
    const files = fs.readdirSync(ARCHIVE_SUBDIR).sort().reverse();
    if (files.length > 0) lastArchive = files[0];
  }

  return {
    retention_days: getRetentionDays(),
    archive_enabled: isArchiveEnabled(),
    store_path: EVIDENCE_PATH,
    archive_path: archivePath,
    total_records: totalRecords,
    last_archive: lastArchive,
  };
}

export async function sweepOldEvidence(): Promise<RetentionSweepResult> {
  const retentionDays = getRetentionDays();
  const archiveEnabled = isArchiveEnabled();
  const cutoffMs = Date.now() - retentionDays * 86_400_000;

  await appendEvidenceRecord({
    evidence_id: hashTraceId("retention", "evidence_retention_sweep_started"),
    trace_id: "retention",
    job_id: "retention",
    type: "evidence_retention_sweep_started",
    timestamp: new Date().toISOString(),
    payload: { retention_days: retentionDays, archive_enabled: archiveEnabled },
  });

  if (!fs.existsSync(EVIDENCE_PATH)) {
    const result: RetentionSweepResult = { archived: 0, kept: 0, total: 0, archive_path: ARCHIVE_SUBDIR };
    await finishSweep(result);
    return result;
  }

  const content = fs.readFileSync(EVIDENCE_PATH, { encoding: "utf8" });
  const lines = content.split("\n").filter((l) => l.trim());

  const oldLines: string[] = [];
  const keepLines: string[] = [];

  for (const line of lines) {
    try {
      const record = JSON.parse(line);
      const ts = new Date(record.timestamp).getTime();
      if (!isNaN(ts) && ts < cutoffMs) {
        oldLines.push(line);
      } else {
        keepLines.push(line);
      }
    } catch {
      keepLines.push(line);
    }
  }

  if (oldLines.length > 0 && archiveEnabled) {
    ensureDir(ARCHIVE_SUBDIR);
    const archiveName = `evidence_${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
    const archivePath = path.join(ARCHIVE_SUBDIR, archiveName);
    await checkFileOperationGovernance({
      kind: "write", path: archivePath, requested_by: "system",
      trace_id: "retention_archive", risk_hint: "low",
    });
    fs.writeFileSync(archivePath, oldLines.join("\n") + "\n", { encoding: "utf8" });

    await appendEvidenceRecord({
      evidence_id: hashTraceId("retention", "evidence_archived"),
      trace_id: "retention",
      job_id: "retention",
      type: "evidence_archived",
      timestamp: new Date().toISOString(),
      payload: {
        archive_path: archivePath,
        archived_count: oldLines.length,
        retention_days: retentionDays,
      },
    });
  }

  await checkFileOperationGovernance({
    kind: "overwrite", path: EVIDENCE_PATH, requested_by: "system",
    trace_id: "retention_trim", risk_hint: "low",
  });
  fs.writeFileSync(EVIDENCE_PATH, keepLines.join("\n") + (keepLines.length > 0 ? "\n" : ""), { encoding: "utf8" });

  const result: RetentionSweepResult = {
    archived: oldLines.length,
    kept: keepLines.length,
    total: lines.length,
    archive_path: ARCHIVE_SUBDIR,
  };

  await finishSweep(result);
  return result;
}

async function finishSweep(result: RetentionSweepResult): Promise<void> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId("retention", "evidence_retention_sweep_finished"),
    trace_id: "retention",
    job_id: "retention",
    type: "evidence_retention_sweep_finished",
    timestamp: new Date().toISOString(),
    payload: result as unknown as Record<string, unknown>,
  });
}
