import fs from "node:fs";
import path from "node:path";
import type { ExecutionEvidenceRecord, EvidenceQuery } from "./execution-evidence.types.js";

const DEFAULT_STORE_DIR = path.join(process.cwd(), ".data", "execution-evidence");
const DEFAULT_FILE = "evidence.jsonl";

let storeDir = DEFAULT_STORE_DIR;
let storePath = path.join(storeDir, DEFAULT_FILE);

export function initExecutionEvidenceStore(dir?: string): void {
  if (dir) storeDir = dir;
  storePath = path.join(storeDir, DEFAULT_FILE);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }
}

export async function appendEvidenceRecord(record: ExecutionEvidenceRecord): Promise<void> {
  const line = JSON.stringify(record) + "\n";
  try {
    fs.appendFileSync(storePath, line, { encoding: "utf8" });
  } catch (e: any) {
    console.error(`[execution-evidence] append error: ${e.message}`);
  }
}

export function readEvidenceRecords(query?: EvidenceQuery): ExecutionEvidenceRecord[] {
  if (!fs.existsSync(storePath)) return [];

  const content = fs.readFileSync(storePath, { encoding: "utf8" });
  const lines = content.split("\n").filter((l) => l.trim());

  const records: ExecutionEvidenceRecord[] = [];

  for (const line of lines) {
    try {
      const record = JSON.parse(line) as ExecutionEvidenceRecord;
      if (matchesQuery(record, query)) {
        records.push(record);
      }
    } catch {
    }
  }

  const order = query?.order || "desc";
  if (order === "desc") records.reverse();

  const offset = query?.offset || 0;
  const limit = query?.limit || records.length;

  return records.slice(offset, offset + limit);
}

export function getEvidenceByTrace(traceId: string): ExecutionEvidenceRecord[] {
  return readEvidenceRecords({ trace_id: traceId });
}

export function getEvidenceByJob(jobId: string): ExecutionEvidenceRecord[] {
  return readEvidenceRecords({ job_id: jobId });
}

export function getEvidenceByType(type: string): ExecutionEvidenceRecord[] {
  return readEvidenceRecords({ type: type as any });
}

export function getLatestEvidence(jobId: string): ExecutionEvidenceRecord | undefined {
  const records = readEvidenceRecords({ job_id: jobId, order: "desc", limit: 1 });
  return records[0];
}

export function getEvidenceCount(): number {
  if (!fs.existsSync(storePath)) return 0;
  const content = fs.readFileSync(storePath, { encoding: "utf8" });
  return content.split("\n").filter((l) => l.trim()).length;
}

function matchesQuery(record: ExecutionEvidenceRecord, query?: EvidenceQuery): boolean {
  if (!query) return true;
  if (query.trace_id && record.trace_id !== query.trace_id) return false;
  if (query.job_id && record.job_id !== query.job_id) return false;
  if (query.type && record.type !== query.type) return false;
  return true;
}
