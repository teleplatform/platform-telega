import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type ExecutionApprovalStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "consumed";

export type ExecutionApprovalActionType =
  | "approve"
  | "deny"
  | "consume"
  | "notify";

export interface ExecutionApprovalRequest {
  approval_id: string;
  job_id?: string;
  trace_id?: string;
  task_kind: string;
  target?: string;
  requested_by: "manual" | "system" | "mission_control";
  reason: string;
  status: ExecutionApprovalStatus;
  created_at: string;
  expires_at?: string;
  decided_at?: string;
  decided_by?: string;
  decision_reason?: string;
  consumed_at?: string;
  telegram_message?: {
    chat_id?: string;
    message_id?: number;
  };
}

export interface ExecutionApprovalActionPayload {
  approval_id: string;
  action: ExecutionApprovalActionType;
  actor?: string;
  reason?: string;
}

const APPROVAL_DIR = path.join(process.cwd(), ".data", "execution-evidence");
const APPROVAL_FILE = "execution-approvals.jsonl";
const APPROVAL_PATH = path.join(APPROVAL_DIR, APPROVAL_FILE);

const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

function ensureDir(): void {
  if (!fs.existsSync(APPROVAL_DIR)) {
    fs.mkdirSync(APPROVAL_DIR, { recursive: true });
  }
}

export function readAllExecutionRequests(): ExecutionApprovalRequest[] {
  if (!fs.existsSync(APPROVAL_PATH)) return [];
  const content = fs.readFileSync(APPROVAL_PATH, { encoding: "utf8" });
  return content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l) as ExecutionApprovalRequest;
      } catch {
        return null;
      }
    })
    .filter((r): r is ExecutionApprovalRequest => r !== null);
}

function writeAllRequests(requests: ExecutionApprovalRequest[]): void {
  ensureDir();
  const lines = requests.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(APPROVAL_PATH, lines, { encoding: "utf8" });
}

export function generateExecutionApprovalId(): string {
  return `exa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateExecutionApprovalInput {
  job_id?: string;
  trace_id?: string;
  task_kind: string;
  target?: string;
  requested_by: "manual" | "system" | "mission_control";
  reason: string;
}

export async function createExecutionApprovalRequest(
  input: CreateExecutionApprovalInput,
): Promise<ExecutionApprovalRequest> {
  ensureDir();
  const approvalId = generateExecutionApprovalId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS).toISOString();

  const request: ExecutionApprovalRequest = {
    approval_id: approvalId,
    job_id: input.job_id,
    trace_id: input.trace_id,
    task_kind: input.task_kind,
    target: input.target,
    requested_by: input.requested_by,
    reason: input.reason,
    status: "pending",
    created_at: now,
    expires_at: expiresAt,
  };

  const records = readAllExecutionRequests();
  records.push(request);
  writeAllRequests(records);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(approvalId, "execution_approval_requested"),
    trace_id: input.trace_id || approvalId,
    job_id: approvalId,
    type: "execution_approval_requested",
    timestamp: now,
    payload: {
      approval_id: approvalId,
      task_kind: input.task_kind,
      target: input.target,
      requested_by: input.requested_by,
      reason: input.reason,
      job_id: input.job_id,
      trace_id: input.trace_id,
      expires_at: expiresAt,
    },
  });

  return request;
}

export function getExecutionApprovalRequest(approvalId: string): ExecutionApprovalRequest | null {
  return readAllExecutionRequests().find((r) => r.approval_id === approvalId) || null;
}

export function listPendingExecutionApprovals(): ExecutionApprovalRequest[] {
  expireOldExecutionApprovals();
  return readAllExecutionRequests().filter((r) => r.status === "pending");
}

export async function approveExecutionApproval(
  approvalId: string,
  decidedBy: string,
  reason?: string,
): Promise<ExecutionApprovalRequest | null> {
  const records = readAllExecutionRequests();
  const idx = records.findIndex((r) => r.approval_id === approvalId);
  if (idx === -1) return null;

  const request = records[idx];
  if (request.status !== "pending") return null;

  request.status = "approved";
  request.decided_at = new Date().toISOString();
  request.decided_by = decidedBy;
  request.decision_reason = reason;
  records[idx] = request;
  writeAllRequests(records);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(approvalId, "execution_approval_approved"),
    trace_id: request.trace_id || approvalId,
    job_id: approvalId,
    type: "execution_approval_approved",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: approvalId,
      decided_by: decidedBy,
      reason,
      task_kind: request.task_kind,
    },
  });

  return request;
}

export async function denyExecutionApproval(
  approvalId: string,
  decidedBy: string,
  reason?: string,
): Promise<ExecutionApprovalRequest | null> {
  const records = readAllExecutionRequests();
  const idx = records.findIndex((r) => r.approval_id === approvalId);
  if (idx === -1) return null;

  const request = records[idx];
  if (request.status !== "pending") return null;

  request.status = "denied";
  request.decided_at = new Date().toISOString();
  request.decided_by = decidedBy;
  request.decision_reason = reason;
  records[idx] = request;
  writeAllRequests(records);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(approvalId, "execution_approval_denied"),
    trace_id: request.trace_id || approvalId,
    job_id: approvalId,
    type: "execution_approval_denied",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: approvalId,
      decided_by: decidedBy,
      reason,
      task_kind: request.task_kind,
    },
  });

  return request;
}

export async function markExecutionApprovalConsumed(approvalId: string): Promise<ExecutionApprovalRequest | null> {
  const records = readAllExecutionRequests();
  const idx = records.findIndex((r) => r.approval_id === approvalId);
  if (idx === -1) return null;

  const request = records[idx];
  if (request.status !== "approved") return null;

  request.status = "consumed";
  request.consumed_at = new Date().toISOString();
  records[idx] = request;
  writeAllRequests(records);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(approvalId, "execution_approval_consumed"),
    trace_id: request.trace_id || approvalId,
    job_id: approvalId,
    type: "execution_approval_consumed",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: approvalId,
      task_kind: request.task_kind,
    },
  });

  return request;
}

export function expireOldExecutionApprovals(): number {
  const records = readAllExecutionRequests();
  let expired = 0;
  const now = Date.now();

  const updated = records.map((r) => {
    if (r.status === "pending" && r.expires_at && new Date(r.expires_at).getTime() < now) {
      expired++;
      return { ...r, status: "expired" as ExecutionApprovalStatus, decided_at: new Date().toISOString(), decision_reason: "auto_expired" };
    }
    return r;
  });

  if (expired > 0) {
    writeAllRequests(updated);
  }

  return expired;
}

export async function handleExecutionApprovalAction(
  payload: ExecutionApprovalActionPayload,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(payload.approval_id, "execution_approval_action_received"),
    trace_id: payload.approval_id,
    job_id: payload.approval_id,
    type: "execution_approval_action_received",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: payload.approval_id,
      action: payload.action,
      actor: payload.actor,
      reason: payload.reason,
    },
  });

  switch (payload.action) {
    case "approve": {
      const result = await approveExecutionApproval(payload.approval_id, payload.actor || "action", payload.reason);
      if (!result) return { ok: false, error: "approval not found or not pending" };
      return { ok: true, result };
    }
    case "deny": {
      const result = await denyExecutionApproval(payload.approval_id, payload.actor || "action", payload.reason);
      if (!result) return { ok: false, error: "approval not found or not pending" };
      return { ok: true, result };
    }
    case "consume": {
      const result = await markExecutionApprovalConsumed(payload.approval_id);
      if (!result) return { ok: false, error: "approval not found or not approved" };
      return { ok: true, result };
    }
    case "notify": {
      const request = getExecutionApprovalRequest(payload.approval_id);
      if (!request) return { ok: false, error: "approval not found" };
      await notifyExecutionApprovalRequired(request);
      return { ok: true };
    }
  }
}

export async function notifyExecutionApprovalRequired(
  request: ExecutionApprovalRequest,
): Promise<void> {
  const hints = [
    `approve:/runtime/execution/approvals/action approval_id=${request.approval_id}`,
    `deny:/runtime/execution/approvals/action approval_id=${request.approval_id}`,
    `consume:/runtime/execution/approvals/action approval_id=${request.approval_id}`,
    `notify:/runtime/execution/approvals/action approval_id=${request.approval_id}`,
  ].join("\n");

  const message = [
    `Execution approval required`,
    ``,
    `approval_id: ${request.approval_id}`,
    `task_kind: ${request.task_kind}`,
    `target: ${request.target || "-"}`,
    `reason: ${request.reason}`,
    `requested_by: ${request.requested_by}`,
    `job_id: ${request.job_id || "-"}`,
    `trace_id: ${request.trace_id || "-"}`,
    `expires_at: ${request.expires_at || "-"}`,
    ``,
    `Approve:`,
    `npm run trace:inspect -- --execution-approve ${request.approval_id}`,
    ``,
    `Deny:`,
    `npm run trace:inspect -- --execution-deny ${request.approval_id}`,
    ``,
    `Actions:`,
    hints,
  ].join("\n");

  console.log(`\n[MISSION] ${message}\n`);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(request.approval_id, "execution_approval_notification_sent"),
    trace_id: request.trace_id || request.approval_id,
    job_id: request.approval_id,
    type: "execution_approval_notification_sent",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: request.approval_id,
      task_kind: request.task_kind,
      message,
    },
  });
}
