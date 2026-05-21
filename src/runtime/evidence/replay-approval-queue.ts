import fs from "node:fs";
import path from "node:path";
import type { RuntimeTarget } from "../capability/capability.types.js";
import { appendEvidenceRecord } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";
import { executeReplay } from "./replay-executor.js";
import type { ReplayExecutionResult } from "./replay-executor.js";
import { renderAndEmitReplayApproval } from "./replay-approval-renderer.js";
import { renderAndEmitTelegramKeyboard } from "../mission-control/telegram-inline-keyboard.js";
import { sendTelegramMissionControlMessage, loadTelegramSenderConfig } from "../mission-control/telegram-sender.js";

export type ReplayApprovalStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "consumed";

export interface ReplayApprovalRequest {
  approval_id: string;
  trace_id: string;
  requested_by: "manual" | "system" | "mission_control";
  replay_reason?: string;
  target_override?: RuntimeTarget;
  force?: boolean;
  status: ReplayApprovalStatus;
  created_at: string;
  expires_at?: string;
  decided_at?: string;
  decided_by?: string;
  decision_reason?: string;
  telegram_message?: {
    chat_id?: string;
    message_id?: number;
  };
}

const APPROVAL_DIR = path.join(process.cwd(), ".data", "execution-evidence");
const APPROVAL_FILE = "replay-approvals.jsonl";
const APPROVAL_PATH = path.join(APPROVAL_DIR, APPROVAL_FILE);

const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

function ensureDir(): void {
  if (!fs.existsSync(APPROVAL_DIR)) {
    fs.mkdirSync(APPROVAL_DIR, { recursive: true });
  }
}

export function readAllRequestsForSweeper(): ReplayApprovalRequest[] {
  return readAllRequests();
}

export function writeAllRequestsForSweeper(requests: ReplayApprovalRequest[]): void {
  writeAllRequests(requests);
}

function readAllRequests(): ReplayApprovalRequest[] {
  if (!fs.existsSync(APPROVAL_PATH)) return [];
  const content = fs.readFileSync(APPROVAL_PATH, { encoding: "utf8" });
  return content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l) as ReplayApprovalRequest;
      } catch {
        return null;
      }
    })
    .filter((r): r is ReplayApprovalRequest => r !== null);
}

function writeAllRequests(requests: ReplayApprovalRequest[]): void {
  ensureDir();
  const lines = requests.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(APPROVAL_PATH, lines, { encoding: "utf8" });
}

export type ReplayApprovalAction =
  | "approve"
  | "deny"
  | "execute"
  | "notify";

export interface ReplayApprovalActionPayload {
  approval_id: string;
  action: ReplayApprovalAction;
  actor?: string;
  reason?: string;
}

export async function handleReplayApprovalAction(
  payload: ReplayApprovalActionPayload,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(payload.approval_id, "replay_approval_action_received"),
    trace_id: payload.approval_id,
    job_id: payload.approval_id,
    type: "replay_approval_action_received",
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
      const result = await approveReplay(payload.approval_id, payload.actor || "action", payload.reason);
      if (!result) return { ok: false, error: "approval not found or not pending" };
      return { ok: true, result };
    }
    case "deny": {
      const result = await denyReplay(payload.approval_id, payload.actor || "action", payload.reason);
      if (!result) return { ok: false, error: "approval not found or not pending" };
      return { ok: true, result };
    }
    case "execute": {
      const result = await executeApprovedReplay(payload.approval_id);
      return { ok: result.status === "started", result };
    }
    case "notify": {
      const request = getApprovalRequest(payload.approval_id);
      if (!request) return { ok: false, error: "approval not found" };
      await notifyApprovalRequired(request);
      return { ok: true };
    }
  }
}

export async function notifyApprovalRequired(
  request: ReplayApprovalRequest,
): Promise<void> {
  const hints = [
    `approve:/runtime/replay/approvals/action approval_id=${request.approval_id}`,
    `deny:/runtime/replay/approvals/action approval_id=${request.approval_id}`,
    `execute:/runtime/replay/approvals/action approval_id=${request.approval_id}`,
    `notify:/runtime/replay/approvals/action approval_id=${request.approval_id}`,
  ].join("\n");

  const message = [
    `Replay approval required`,
    ``,
    `approval_id: ${request.approval_id}`,
    `trace_id: ${request.trace_id}`,
    `reason: ${request.replay_reason || "-"}`,
    `requested_by: ${request.requested_by}`,
    `target_override: ${request.target_override || "-"}`,
    `force: ${request.force ? "yes" : "no"}`,
    `expires_at: ${request.expires_at || "-"}`,
    ``,
    `Approve:`,
    `npm run trace:inspect -- --approve ${request.approval_id}`,
    ``,
    `Deny:`,
    `npm run trace:inspect -- --deny ${request.approval_id}`,
    ``,
    `Execute after approve:`,
    `npm run trace:inspect -- --execute-approval ${request.approval_id}`,
    ``,
    `Actions:`,
    hints,
  ].join("\n");

  console.log(`\n[MISSION] ${message}\n`);

  const rendered = await renderAndEmitReplayApproval(request);
  console.log(`[MISSION] buttons: ${JSON.stringify(rendered.buttons.map((b) => ({ label: b.label, action: b.action })))}`);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(request.approval_id, "replay_approval_notification_sent"),
    trace_id: request.trace_id,
    job_id: request.approval_id,
    type: "replay_approval_notification_sent",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: request.approval_id,
      trace_id: request.trace_id,
      message,
      buttons: rendered.buttons.map((b) => ({ label: b.label, action: b.action })),
    },
  });

  const senderConfig = loadTelegramSenderConfig();
  if (senderConfig.enabled || senderConfig.dry_run) {
    const chatId = senderConfig.default_chat_id || "0";
    const telegramMessage = await renderAndEmitTelegramKeyboard(request, chatId);
    const sendResult = await sendTelegramMissionControlMessage(telegramMessage, senderConfig);
    if (sendResult.ok) {
      console.log(`[telegram-sender] sent to ${sendResult.chat_id}${sendResult.dry_run ? " (dry-run)" : ""}`);
      if (sendResult.message_id) {
        storeTelegramMessageRef(request.approval_id, sendResult.chat_id || chatId, sendResult.message_id);
      }
    } else if (sendResult.error !== "disabled") {
      console.warn(`[telegram-sender] failed: ${sendResult.error}`);
    }
  }
}

export function storeTelegramMessageRef(
  approvalId: string,
  chat_id: string,
  message_id: number,
): ReplayApprovalRequest | null {
  const records = readAllRequests();
  const idx = records.findIndex((r) => r.approval_id === approvalId);
  if (idx === -1) return null;
  records[idx].telegram_message = { chat_id, message_id };
  writeAllRequests(records);
  return records[idx];
}

export function generateApprovalId(): string {
  return `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createApprovalRequest(input: {
  trace_id: string;
  requested_by: "manual" | "system" | "mission_control";
  replay_reason?: string;
  target_override?: RuntimeTarget;
  force?: boolean;
  governance_reason?: string;
}): Promise<ReplayApprovalRequest> {
  ensureDir();
  const approvalId = generateApprovalId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS).toISOString();

  const request: ReplayApprovalRequest = {
    approval_id: approvalId,
    trace_id: input.trace_id,
    requested_by: input.requested_by,
    replay_reason: input.replay_reason,
    target_override: input.target_override,
    force: input.force,
    status: "pending",
    created_at: now,
    expires_at: expiresAt,
  };

  const records = readAllRequests();
  records.push(request);
  writeAllRequests(records);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(approvalId, "replay_approval_requested"),
    trace_id: input.trace_id,
    job_id: approvalId,
    type: "replay_approval_requested",
    timestamp: now,
    payload: {
      approval_id: approvalId,
      requested_by: input.requested_by,
      replay_reason: input.replay_reason,
      target_override: input.target_override,
      force: input.force,
      governance_reason: input.governance_reason,
      expires_at: expiresAt,
    },
  });

  await notifyApprovalRequired(request);

  return request;
}

export function getApprovalRequest(approvalId: string): ReplayApprovalRequest | null {
  return readAllRequests().find((r) => r.approval_id === approvalId) || null;
}

export function listPendingApprovals(): ReplayApprovalRequest[] {
  expireOldApprovals();
  return readAllRequests().filter((r) => r.status === "pending");
}

export async function approveReplay(
  approvalId: string,
  decidedBy: string,
  reason?: string,
): Promise<ReplayApprovalRequest | null> {
  const records = readAllRequests();
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
    evidence_id: hashTraceId(approvalId, "replay_approval_approved"),
    trace_id: request.trace_id,
    job_id: approvalId,
    type: "replay_approval_approved",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: approvalId,
      decided_by: decidedBy,
      reason,
      trace_id: request.trace_id,
    },
  });

  return request;
}

export async function denyReplay(
  approvalId: string,
  decidedBy: string,
  reason?: string,
): Promise<ReplayApprovalRequest | null> {
  const records = readAllRequests();
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
    evidence_id: hashTraceId(approvalId, "replay_approval_denied"),
    trace_id: request.trace_id,
    job_id: approvalId,
    type: "replay_approval_denied",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: approvalId,
      decided_by: decidedBy,
      reason,
      trace_id: request.trace_id,
    },
  });

  return request;
}

export async function markApprovalConsumed(approvalId: string): Promise<ReplayApprovalRequest | null> {
  const records = readAllRequests();
  const idx = records.findIndex((r) => r.approval_id === approvalId);
  if (idx === -1) return null;

  const request = records[idx];
  if (request.status !== "approved") return null;

  request.status = "consumed";
  records[idx] = request;
  writeAllRequests(records);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(approvalId, "replay_approval_consumed"),
    trace_id: request.trace_id,
    job_id: approvalId,
    type: "replay_approval_consumed",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: approvalId,
      trace_id: request.trace_id,
    },
  });

  return request;
}

export function expireOldApprovals(): number {
  const records = readAllRequests();
  let expired = 0;
  const now = Date.now();

  const updated = records.map((r) => {
    if (r.status === "pending" && r.expires_at && new Date(r.expires_at).getTime() < now) {
      expired++;
      return { ...r, status: "expired" as ReplayApprovalStatus, decided_at: new Date().toISOString(), decision_reason: "auto_expired" };
    }
    return r;
  });

  if (expired > 0) {
    writeAllRequests(updated);
  }

  return expired;
}

export async function executeApprovedReplay(
  approvalId: string,
): Promise<ReplayExecutionResult & { approval_id?: string }> {
  const request = getApprovalRequest(approvalId);
  if (!request) {
    return { original_trace_id: approvalId, status: "failed", reason: "approval_not_found" };
  }

  if (request.status !== "approved") {
    return { original_trace_id: request.trace_id, status: "blocked", reason: `approval_not_approved: ${request.status}` };
  }

  if (request.expires_at && new Date(request.expires_at).getTime() < Date.now()) {
    await markApprovalConsumed(approvalId);
    return { original_trace_id: request.trace_id, status: "blocked", reason: "approval_expired" };
  }

  const result = await executeReplay(request.trace_id, {
    requested_by: request.requested_by,
    force: request.force,
    target_override: request.target_override,
    reason: request.replay_reason || "approved_replay",
    approved_replay: true,
  });

  if (result.status === "started") {
    await markApprovalConsumed(approvalId);
  }

  return { ...result, approval_id: approvalId };
}
