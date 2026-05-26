import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type ReplayRecoveryStatus = "checking_governance" | "started" | "finished" | "failed" | "resumed";

export interface ReplayRecoveryCheckpoint {
  original_trace_id: string;
  replay_trace_id: string;
  status: ReplayRecoveryStatus;
  updated_at: string;
  replay_job_id?: string;
  error?: string;
  options?: Record<string, unknown>;
}

const REPLAY_CHECKPOINT_PATH = path.join(process.cwd(), ".data", "mission-control", "replay-checkpoints.jsonl");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendJsonl(filePath: string, value: Record<string, unknown>): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, { encoding: "utf8" });
}

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((value): value is T => value !== null);
}

export async function saveReplayRecoveryCheckpoint(checkpoint: ReplayRecoveryCheckpoint): Promise<ReplayRecoveryCheckpoint> {
  appendJsonl(REPLAY_CHECKPOINT_PATH, checkpoint as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${checkpoint.replay_trace_id}_${checkpoint.status}`, "replay_recovery_checkpoint_saved"),
    trace_id: checkpoint.original_trace_id,
    job_id: "mission_control",
    type: "replay_recovery_checkpoint_saved",
    timestamp: checkpoint.updated_at,
    payload: checkpoint as unknown as Record<string, unknown>,
  });
  return checkpoint;
}

export function readReplayRecoveryCheckpoints(): ReplayRecoveryCheckpoint[] {
  return readJsonl<ReplayRecoveryCheckpoint>(REPLAY_CHECKPOINT_PATH);
}

export async function resumeInterruptedReplay(traceId: string): Promise<ReplayRecoveryCheckpoint | null> {
  const checkpoints = readReplayRecoveryCheckpoints()
    .filter((checkpoint) => checkpoint.original_trace_id === traceId || checkpoint.replay_trace_id === traceId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const latest = checkpoints[0];
  if (!latest || latest.status === "finished" || latest.status === "resumed") return null;
  const resumed: ReplayRecoveryCheckpoint = {
    ...latest,
    status: "resumed",
    updated_at: new Date().toISOString(),
  };
  appendJsonl(REPLAY_CHECKPOINT_PATH, resumed as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${resumed.replay_trace_id}_resumed`, "replay_recovery_resumed"),
    trace_id: resumed.original_trace_id,
    job_id: "mission_control",
    type: "replay_recovery_resumed",
    timestamp: resumed.updated_at,
    payload: resumed as unknown as Record<string, unknown>,
  });
  return resumed;
}

