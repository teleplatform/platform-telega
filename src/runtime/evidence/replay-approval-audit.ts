import { readAllRequestsForSweeper } from "./replay-approval-queue.js";
import { getEvidenceByType, getEvidenceCount } from "./execution-evidence-store.js";
import { appendEvidenceRecord } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";

export interface ApprovalAuditReport {
  generated_at: string;
  approval_stats: {
    pending: number;
    approved: number;
    denied: number;
    expired: number;
    consumed: number;
    total: number;
  };
  replay_stats: {
    requested: number;
    started: number;
    blocked: number;
    finished: number;
    total: number;
  };
  callback_stats: {
    unauthorized: number;
    duplicate: number;
    total_callbacks: number;
  };
  evidence_total: number;
}

export function getApprovalStats() {
  const requests = readAllRequestsForSweeper();
  return {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    denied: requests.filter((r) => r.status === "denied").length,
    expired: requests.filter((r) => r.status === "expired").length,
    consumed: requests.filter((r) => r.status === "consumed").length,
    total: requests.length,
  };
}

export function getReplayStats() {
  const requested = getEvidenceByType("replay_requested").length;
  const started = getEvidenceByType("replay_started").length;
  const blocked = getEvidenceByType("replay_blocked").length;
  const finished = getEvidenceByType("replay_finished").length;
  return { requested, started, blocked, finished, total: requested + started + blocked + finished };
}

export function getCallbackStats() {
  const unauthorized = getEvidenceByType("telegram_callback_denied").length;
  const duplicate = getEvidenceByType("telegram_callback_duplicate_detected").length;
  const callbacks = getEvidenceByType("replay_approval_callback_received").length;
  return { unauthorized, duplicate, total_callbacks: callbacks };
}

export async function buildReplayApprovalAuditReport(): Promise<ApprovalAuditReport> {
  const approval_stats = getApprovalStats();
  const replay_stats = getReplayStats();
  const callback_stats = getCallbackStats();
  const evidence_total = getEvidenceCount();

  const report: ApprovalAuditReport = {
    generated_at: new Date().toISOString(),
    approval_stats,
    replay_stats,
    callback_stats,
    evidence_total,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId("audit", "replay_approval_audit_generated"),
    trace_id: "audit",
    job_id: "audit",
    type: "replay_approval_audit_generated",
    timestamp: report.generated_at,
    payload: report as unknown as Record<string, unknown>,
  });

  return report;
}
