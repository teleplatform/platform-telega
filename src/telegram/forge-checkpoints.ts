import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { getAccountLabel } from "./bot.js";
import fs from "fs/promises";
import path from "path";

const CHECKPOINTS_DIR = path.join(process.cwd(), "data/forge");
const CHECKPOINTS_FILE = path.join(CHECKPOINTS_DIR, "checkpoints.jsonl");
const HEARTBEATS_FILE = path.join(CHECKPOINTS_DIR, "heartbeats.jsonl");

const STALL_THRESHOLD_MS = 30 * 60 * 1000;
const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000;

export type CheckpointStatus = 
  | "pending"
  | "running"
  | "paused"
  | "paused_recoverable"
  | "requires_manual_review"
  | "queued_for_verify"
  | "complete"
  | "failed"
  | "stalled"
  | "recovered";

export interface Checkpoint {
  checkpoint_id: string;
  workflow_id: string;
  stage: string;
  status: CheckpointStatus;
  state_snapshot: Record<string, any>;
  evidence_refs: string[];
  state_data?: string;
  timestamp: number;
}

export interface Heartbeat {
  workflow_id: string;
  last_heartbeat: number;
  stage: string;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(CHECKPOINTS_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveCheckpoint(
  workflowId: string,
  stage: string,
  status: CheckpointStatus,
  options?: { stateSnapshot?: Record<string, any>; evidenceRefs?: string[]; stateData?: string }
): Promise<Checkpoint> {
  await ensureDir();

  const checkpoint: Checkpoint = {
    checkpoint_id: makeId("chk"),
    workflow_id: workflowId,
    stage,
    status,
    state_snapshot: options?.stateSnapshot || {},
    evidence_refs: options?.evidenceRefs || [],
    state_data: options?.stateData,
    timestamp: Date.now(),
  };

  const line = JSON.stringify(checkpoint) + "\n";
  await fs.appendFile(CHECKPOINTS_FILE, line, "utf-8");

  await updateHeartbeat(workflowId, stage);

  console.log("[forge-checkpoint] saved", { workflow_id: workflowId, stage, status });

  return checkpoint;
}

export async function getLatestCheckpoint(workflowId: string): Promise<Checkpoint | null> {
  const checkpoints: Checkpoint[] = [];

  try {
    await ensureDir();
    const content = await fs.readFile(CHECKPOINTS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const cp = JSON.parse(line) as Checkpoint;
        if (cp.workflow_id === workflowId) {
          checkpoints.push(cp);
        }
      } catch {}
    }
  } catch {}

  if (checkpoints.length === 0) return null;

  return checkpoints.sort((a, b) => b.timestamp - a.timestamp)[0];
}

export async function getWorkflowCheckpoints(workflowId: string): Promise<Checkpoint[]> {
  const checkpoints: Checkpoint[] = [];

  try {
    await ensureDir();
    const content = await fs.readFile(CHECKPOINTS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const cp = JSON.parse(line) as Checkpoint;
        if (cp.workflow_id === workflowId) {
          checkpoints.push(cp);
        }
      } catch {}
    }
  } catch {}

  return checkpoints.sort((a, b) => a.timestamp - b.timestamp);
}

export async function updateHeartbeat(workflowId: string, stage: string): Promise<void> {
  await ensureDir();

  const heartbeat: Heartbeat = {
    workflow_id: workflowId,
    last_heartbeat: Date.now(),
    stage,
  };

  const heartbeats: Heartbeat[] = [];
  const existing = new Set<string>();

  try {
    const content = await fs.readFile(HEARTBEATS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const hb = JSON.parse(line) as Heartbeat;
        if (hb.workflow_id === workflowId) {
          continue;
        }
        heartbeats.push(hb);
        existing.add(hb.workflow_id);
      } catch {}
    }
  } catch {}

  if (!existing.has(workflowId)) {
    heartbeats.push(heartbeat);
  }

  const newContent = heartbeats.map(hb => JSON.stringify(hb)).join("\n") + "\n";
  await fs.writeFile(HEARTBEATS_FILE, newContent, "utf-8");
}

export async function checkStalledWorkflows(): Promise<string[]> {
  const stalled: string[] = [];
  const now = Date.now();

  try {
    const content = await fs.readFile(HEARTBEATS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const hb = JSON.parse(line) as Heartbeat;
        const timeSinceLast = now - hb.last_heartbeat;

        if (timeSinceLast > STALL_THRESHOLD_MS) {
          stalled.push(hb.workflow_id);
        }
      } catch {}
    }
  } catch {}

  return stalled;
}

export async function markStalled(workflowId: string): Promise<void> {
  await saveCheckpoint(workflowId, "unknown", "stalled", {
    stateData: "Workflow stalled - no heartbeat received",
  });
}

export async function pauseWorkflow(workflowId: string): Promise<{ ok: boolean; error?: string }> {
  const latest = await getLatestCheckpoint(workflowId);

  if (!latest) {
    return { ok: false, error: "No checkpoint found" };
  }

  if (latest.status === "complete" || latest.status === "failed") {
    return { ok: false, error: "Cannot pause completed or failed workflow" };
  }

  const newStatus: CheckpointStatus = latest.status === "running" ? "paused" : latest.status;

  await saveCheckpoint(workflowId, latest.stage, newStatus, {
    stateSnapshot: latest.state_snapshot,
    evidenceRefs: latest.evidence_refs,
  });

  return { ok: true };
}

export async function resumeWorkflow(workflowId: string): Promise<{ ok: boolean; error?: string }> {
  const latest = await getLatestCheckpoint(workflowId);

  if (!latest) {
    return { ok: false, error: "No checkpoint found" };
  }

  if (latest.status === "requires_manual_review") {
    return { ok: false, error: "Requires manual review before resume" };
  }

  const newStatus: CheckpointStatus = "running";

  await saveCheckpoint(workflowId, latest.stage, newStatus, {
    stateSnapshot: latest.state_snapshot,
    evidenceRefs: latest.evidence_refs,
  });

  return { ok: true };
}

export async function recoverWorkflow(workflowId: string): Promise<{ ok: boolean; checkpoint?: Checkpoint; error?: string }> {
  const checkpoints = await getWorkflowCheckpoints(workflowId);

  if (checkpoints.length === 0) {
    return { ok: false, error: "No checkpoints found" };
  }

  const latest = checkpoints[checkpoints.length - 1];

  if (latest.status === "requires_manual_review") {
    return { ok: false, error: "Requires manual review" };
  }

  await saveCheckpoint(workflowId, latest.stage, "recovered", {
    stateSnapshot: latest.state_snapshot,
    evidenceRefs: latest.evidence_refs,
  });

  return { ok: true, checkpoint: latest };
}

export function formatCheckpointList(checkpoints: Checkpoint[], lang: Language = "ru"): string {
  if (checkpoints.length === 0) {
    return lang === "ru" ? "Нет checkpoint'ов" : "No checkpoints";
  }

  const lines = [lang === "ru" ? "💾 Checkpoints:" : "💾 Checkpoints:"];

  for (const cp of checkpoints.slice(-10)) {
    const icon = cp.status === "complete" ? "✅" :
                 cp.status === "failed" ? "❌" :
                 cp.status === "stalled" ? "⛔" :
                 cp.status === "paused" ? "⏸" : "⏳";

    const date = new Date(cp.timestamp).toLocaleString();
    lines.push(`${icon} ${cp.stage} | ${cp.status} | ${date}`);
  }

  return lines.join("\n");
}

export function formatRecoveryReport(checkpoint: Checkpoint, lang: Language = "ru"): string {
  const lines = [
    lang === "ru" ? "🔄 Recovery Report" : "🔄 Recovery Report",
    `Workflow: #${checkpoint.workflow_id.slice(-8)}`,
    `Stage: ${checkpoint.stage}`,
    `Status: ${checkpoint.status}`,
    `State: ${JSON.stringify(checkpoint.state_snapshot || {}).slice(0, 200)}`,
    `Timestamp: ${new Date(checkpoint.timestamp).toLocaleString()}`,
  ];

  return lines.join("\n");
}