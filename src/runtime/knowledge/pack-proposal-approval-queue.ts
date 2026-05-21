import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { PackProposal } from "./knowledge-to-pack-generator.js";

export interface PackApproval {
  approval_id: string;
  pack_id: string;
  status: "pending" | "granted" | "denied";
  reason?: string;
  created_at: string;
  updated_at: string;
}

const APPROVALS: Map<string, PackApproval> = new Map();
let approvalCounter = 0;

export async function requestPackApproval(pack: PackProposal): Promise<PackApproval> {
  approvalCounter++;
  const approval: PackApproval = {
    approval_id: `pack_approval_${Date.now()}_${approvalCounter}`,
    pack_id: pack.pack_id,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  APPROVALS.set(approval.approval_id, approval);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(approval.approval_id, "pack_proposal_approval_requested"),
    trace_id: approval.approval_id,
    job_id: "knowledge",
    type: "pack_proposal_approval_requested",
    timestamp: approval.created_at,
    payload: {
      approval_id: approval.approval_id,
      pack_id: pack.pack_id,
      pack_source: pack.source,
      modules_affected: pack.modules_affected,
    },
  });

  return approval;
}

export async function approvePack(approvalId: string): Promise<PackApproval | null> {
  const approval = APPROVALS.get(approvalId);
  if (!approval) return null;

  approval.status = "granted";
  approval.updated_at = new Date().toISOString();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${approvalId}_granted`, "pack_proposal_approval_granted"),
    trace_id: approvalId,
    job_id: "knowledge",
    type: "pack_proposal_approval_granted",
    timestamp: approval.updated_at,
    payload: { approval_id: approvalId, pack_id: approval.pack_id },
  });

  return approval;
}

export async function denyPack(approvalId: string, reason: string): Promise<PackApproval | null> {
  const approval = APPROVALS.get(approvalId);
  if (!approval) return null;

  approval.status = "denied";
  approval.reason = reason;
  approval.updated_at = new Date().toISOString();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${approvalId}_denied`, "pack_proposal_approval_denied"),
    trace_id: approvalId,
    job_id: "knowledge",
    type: "pack_proposal_approval_denied",
    timestamp: approval.updated_at,
    payload: { approval_id: approvalId, pack_id: approval.pack_id, reason },
  });

  return approval;
}

export function getPackApproval(approvalId: string): PackApproval | null {
  return APPROVALS.get(approvalId) || null;
}

export function getPendingApprovals(): PackApproval[] {
  return Array.from(APPROVALS.values()).filter((a) => a.status === "pending");
}
