import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type LearningApprovalStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "consumed";

export interface LearningApprovalRequest {
  approval_id: string;
  proposal_id: string;
  trace_id: string;
  source_job_id: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  status: LearningApprovalStatus;
  requested_by: "manual" | "system" | "mission_control";
  created_at: string;
  expires_at?: string;
  decided_at?: string;
  decided_by?: string;
  decision_reason?: string;
  consumed_at?: string;
}

const APPROVAL_DIR = path.join(process.cwd(), ".data", "execution-evidence");
const APPROVAL_FILE = "learning-approvals.jsonl";
const APPROVAL_PATH = path.join(APPROVAL_DIR, APPROVAL_FILE);

const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

function ensureDir(): void {
  if (!fs.existsSync(APPROVAL_DIR)) {
    fs.mkdirSync(APPROVAL_DIR, { recursive: true });
  }
}

export function readAllLearningApprovals(): LearningApprovalRequest[] {
  if (!fs.existsSync(APPROVAL_PATH)) return [];
  const content = fs.readFileSync(APPROVAL_PATH, "utf8");
  return content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as LearningApprovalRequest);
}

function writeAllLearningApprovals(requests: LearningApprovalRequest[]): void {
  ensureDir();
  const lines = requests.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(APPROVAL_PATH, lines, "utf8");
}

export function createLearningApprovalRequest(
  proposalId: string,
  traceId: string,
  sourceJobId: string,
  type: string,
  title: string,
  description: string,
  severity: string,
  requestedBy: "manual" | "system" | "mission_control" = "system",
): LearningApprovalRequest {
  const requests = readAllLearningApprovals();
  const approvalId = `la_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + APPROVAL_TTL_MS);

  const request: LearningApprovalRequest = {
    approval_id: approvalId,
    proposal_id: proposalId,
    trace_id: traceId,
    source_job_id: sourceJobId,
    type,
    title,
    description,
    severity,
    status: "pending",
    requested_by: requestedBy,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  requests.push(request);
  writeAllLearningApprovals(requests);

  const recordType = "learning_approval_requested" as const;
  appendEvidenceRecord({
    evidence_id: hashTraceId(approvalId, recordType),
    trace_id: traceId,
    job_id: sourceJobId,
    type: recordType,
    timestamp: now.toISOString(),
    payload: {
      approval_id: approvalId,
      proposal_id: proposalId,
      type,
      title,
      severity,
      status: "pending",
    },
  });

  return request;
}

function findAndUpdate(
  approvalId: string,
  updater: (r: LearningApprovalRequest) => LearningApprovalRequest | null,
): LearningApprovalRequest | null {
  const requests = readAllLearningApprovals();
  const idx = requests.findIndex((r) => r.approval_id === approvalId);
  if (idx === -1) return null;

  const updated = updater(requests[idx]);
  if (!updated) return null;

  requests[idx] = updated;
  writeAllLearningApprovals(requests);
  return updated;
}

export function approveLearningApproval(
  approvalId: string,
  decidedBy: string = "manual",
  reason?: string,
): LearningApprovalRequest | null {
  const now = new Date().toISOString();
  return findAndUpdate(approvalId, (r) => {
    if (r.status !== "pending") return null;
    r.status = "approved";
    r.decided_at = now;
    r.decided_by = decidedBy;
    r.decision_reason = reason;

    const recordType = "learning_approval_approved" as const;
    appendEvidenceRecord({
      evidence_id: hashTraceId(approvalId, recordType),
      trace_id: r.trace_id,
      job_id: r.source_job_id,
      type: recordType,
      timestamp: now,
      payload: {
        approval_id: approvalId,
        proposal_id: r.proposal_id,
        decided_by: decidedBy,
        reason,
      },
    });

    return r;
  });
}

export function denyLearningApproval(
  approvalId: string,
  decidedBy: string = "manual",
  reason?: string,
): LearningApprovalRequest | null {
  const now = new Date().toISOString();
  return findAndUpdate(approvalId, (r) => {
    if (r.status !== "pending") return null;
    r.status = "denied";
    r.decided_at = now;
    r.decided_by = decidedBy;
    r.decision_reason = reason;

    const recordType = "learning_approval_denied" as const;
    appendEvidenceRecord({
      evidence_id: hashTraceId(approvalId, recordType),
      trace_id: r.trace_id,
      job_id: r.source_job_id,
      type: recordType,
      timestamp: now,
      payload: {
        approval_id: approvalId,
        proposal_id: r.proposal_id,
        decided_by: decidedBy,
        reason,
      },
    });

    return r;
  });
}

export function consumeLearningApproval(approvalId: string): LearningApprovalRequest | null {
  const now = new Date().toISOString();
  return findAndUpdate(approvalId, (r) => {
    if (r.status !== "approved") return null;
    r.status = "consumed";
    r.consumed_at = now;

    const recordType = "learning_approval_consumed" as const;
    appendEvidenceRecord({
      evidence_id: hashTraceId(approvalId, recordType),
      trace_id: r.trace_id,
      job_id: r.source_job_id,
      type: recordType,
      timestamp: now,
      payload: {
        approval_id: approvalId,
        proposal_id: r.proposal_id,
      },
    });

    return r;
  });
}

export function getLearningApprovalRequest(approvalId: string): LearningApprovalRequest | null {
  const requests = readAllLearningApprovals();
  return requests.find((r) => r.approval_id === approvalId) || null;
}

export function listPendingLearningApprovals(): LearningApprovalRequest[] {
  const now = new Date();
  const requests = readAllLearningApprovals();

  for (const r of requests) {
    if (r.status === "pending" && r.expires_at && new Date(r.expires_at) < now) {
      r.status = "expired";
      const recordType = "learning_approval_expired" as const;
      appendEvidenceRecord({
        evidence_id: hashTraceId(r.approval_id, recordType),
        trace_id: r.trace_id,
        job_id: r.source_job_id,
        type: recordType,
        timestamp: new Date().toISOString(),
        payload: {
          approval_id: r.approval_id,
          proposal_id: r.proposal_id,
        },
      });
    }
  }

  writeAllLearningApprovals(requests);
  return requests.filter((r) => r.status === "pending");
}

export async function sweepLearningApprovals(): Promise<{ expired: number }> {
  const now = new Date();
  const requests = readAllLearningApprovals();
  let expired = 0;

  for (const r of requests) {
    if (r.status === "pending" && r.expires_at && new Date(r.expires_at) < now) {
      r.status = "expired";
      expired++;

      const recordType = "learning_approval_expired" as const;
      await appendEvidenceRecord({
        evidence_id: hashTraceId(r.approval_id, recordType),
        trace_id: r.trace_id,
        job_id: r.source_job_id,
        type: recordType,
        timestamp: new Date().toISOString(),
        payload: {
          approval_id: r.approval_id,
          proposal_id: r.proposal_id,
        },
      });
    }
  }

  if (expired > 0) {
    writeAllLearningApprovals(requests);
  }

  return { expired };
}

export function getLearningApprovalStats(): Record<string, number> {
  const requests = readAllLearningApprovals();
  const stats: Record<string, number> = { total: requests.length };
  for (const r of requests) {
    stats[r.status] = (stats[r.status] || 0) + 1;
  }
  return stats;
}
