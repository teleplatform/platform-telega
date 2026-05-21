import { readAllRequestsForSweeper, writeAllRequestsForSweeper } from "./replay-approval-queue.js";
import type { ReplayApprovalRequest } from "./replay-approval-queue.js";
import { appendEvidenceRecord } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";
import { renderApprovalStatusText } from "../mission-control/telegram-approval-status-renderer.js";
import { editTelegramMissionControlMessage, loadTelegramSenderConfig } from "../mission-control/telegram-sender.js";

let sweeperInterval: ReturnType<typeof setInterval> | null = null;
let sweeperLastRunAt: string | null = null;
let sweeperLastResult: {
  scanned: number;
  expired: number;
  edited: number;
  errors: number;
} | null = null;
let sweeperIntervalMs: number = 60_000;

export interface SweepResult {
  expired: number;
  edited: number;
}

export interface ReplayApprovalSweeperStatus {
  enabled: boolean;
  running: boolean;
  interval_ms: number;
  last_run_at: string | null;
  last_result: {
    scanned: number;
    expired: number;
    edited: number;
    errors: number;
  } | null;
}

export function getReplayApprovalSweeperStatus(): ReplayApprovalSweeperStatus {
  return {
    enabled: process.env.REPLAY_APPROVAL_SWEEPER_ENABLED === "true",
    running: sweeperInterval !== null,
    interval_ms: sweeperIntervalMs,
    last_run_at: sweeperLastRunAt,
    last_result: sweeperLastResult,
  };
}

export async function sweepExpiredApprovals(): Promise<SweepResult> {
  let errors = 0;
  const now = Date.now();
  const allRequests = readAllRequestsForSweeper();
  let expiredCount = 0;
  let editCount = 0;
  const updated: ReplayApprovalRequest[] = [];

  for (const req of allRequests) {
    if (req.status === "pending" && req.expires_at && new Date(req.expires_at).getTime() < now) {
      const expired: ReplayApprovalRequest = {
        ...req,
        status: "expired",
        decided_at: new Date().toISOString(),
        decision_reason: "sweeper_expired",
      };
      updated.push(expired);
      expiredCount++;

      await appendEvidenceRecord({
        evidence_id: hashTraceId(req.approval_id, "replay_approval_expired"),
        trace_id: req.trace_id,
        job_id: req.approval_id,
        type: "replay_approval_expired",
        timestamp: new Date().toISOString(),
        payload: {
          approval_id: req.approval_id,
          trace_id: req.trace_id,
          reason: "sweeper_expired",
        },
      });

      const tgMsg = expired.telegram_message;
      if (tgMsg?.chat_id && tgMsg?.message_id) {
        const text = renderApprovalStatusText("expired");
        try {
          const result = await editTelegramMissionControlMessage({
            chat_id: tgMsg.chat_id,
            message_id: tgMsg.message_id,
            text,
          });
          if (result.ok) editCount++;
          else errors++;
        } catch {
          errors++;
        }
      }
    } else {
      updated.push(req);
    }
  }

  if (expiredCount > 0) {
    writeAllRequestsForSweeper(updated);
  }

  sweeperLastRunAt = new Date().toISOString();
  sweeperLastResult = {
    scanned: allRequests.length,
    expired: expiredCount,
    edited: editCount,
    errors,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId("sweeper", "replay_approval_sweeper_ran"),
    trace_id: "sweeper",
    job_id: "sweeper",
    type: "replay_approval_sweeper_ran",
    timestamp: sweeperLastRunAt,
    payload: {
      expired_count: expiredCount,
      edited_count: editCount,
      total_checked: allRequests.length,
      errors,
      running: sweeperInterval !== null,
    },
  });

  return { expired: expiredCount, edited: editCount };
}

export async function startReplayApprovalSweeper(intervalMs: number = 60_000): Promise<boolean> {
  if (sweeperInterval) return false;
  sweeperIntervalMs = intervalMs;

  await appendEvidenceRecord({
    evidence_id: hashTraceId("sweeper", "replay_approval_sweeper_started"),
    trace_id: "sweeper",
    job_id: "sweeper",
    type: "replay_approval_sweeper_started",
    timestamp: new Date().toISOString(),
    payload: { interval_ms: intervalMs },
  });

  sweepExpiredApprovals().catch((err) =>
    console.error("[sweeper] initial sweep error:", err.message),
  );
  sweeperInterval = setInterval(() => {
    sweepExpiredApprovals().catch((err) =>
      console.error("[sweeper] error:", err.message),
    );
  }, intervalMs);

  return true;
}

export async function stopReplayApprovalSweeper(): Promise<boolean> {
  if (!sweeperInterval) return false;

  clearInterval(sweeperInterval);
  sweeperInterval = null;

  await appendEvidenceRecord({
    evidence_id: hashTraceId("sweeper", "replay_approval_sweeper_stopped"),
    trace_id: "sweeper",
    job_id: "sweeper",
    type: "replay_approval_sweeper_stopped",
    timestamp: new Date().toISOString(),
    payload: { last_run_at: sweeperLastRunAt },
  });

  return true;
}

export function isReplayApprovalSweeperEnabled(): boolean {
  return process.env.REPLAY_APPROVAL_SWEEPER_ENABLED === "true";
}

export async function startReplayApprovalSweeperIfEnabled(): Promise<boolean> {
  if (!isReplayApprovalSweeperEnabled()) return false;
  const intervalMs = Math.max(10_000, Number(process.env.REPLAY_APPROVAL_SWEEPER_INTERVAL_MS) || 60_000);
  return startReplayApprovalSweeper(intervalMs);
}
