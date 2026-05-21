import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { LearningApprovalRequest } from "./learning-approval-queue.js";
import { readAllLearningApprovals } from "./learning-approval-queue.js";

export type ImprovementPriority = "low" | "medium" | "high" | "critical";
export type ImprovementStatus = "backlog" | "in_progress" | "done" | "cancelled";

export interface RuntimeImprovementItem {
  improvement_id: string;
  source_trace_id: string;
  source_approval_id: string;
  proposal_type: string;
  priority: ImprovementPriority;
  title: string;
  description: string;
  status: ImprovementStatus;
  evidence_refs: string[];
  approved_by: string;
  created_at: string;
  updated_at: string;
}

const REGISTRY_DIR = path.join(process.cwd(), ".data", "execution-evidence");
const REGISTRY_FILE = "runtime-improvements.jsonl";
const REGISTRY_PATH = path.join(REGISTRY_DIR, REGISTRY_FILE);

function ensureDir(): void {
  if (!fs.existsSync(REGISTRY_DIR)) {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true });
  }
}

export function readAllImprovements(): RuntimeImprovementItem[] {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  const content = fs.readFileSync(REGISTRY_PATH, "utf8");
  return content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as RuntimeImprovementItem);
}

function writeAllImprovements(items: RuntimeImprovementItem[]): void {
  ensureDir();
  const lines = items.map((i) => JSON.stringify(i)).join("\n") + "\n";
  fs.writeFileSync(REGISTRY_PATH, lines, "utf8");
}

export function registerImprovementFromApproval(
  approvedRequest: LearningApprovalRequest,
): RuntimeImprovementItem | null {
  if (approvedRequest.status !== "approved") return null;

  const items = readAllImprovements();
  const alreadyExists = items.some(
    (i) => i.source_approval_id === approvedRequest.approval_id,
  );
  if (alreadyExists) return null;

  const now = new Date().toISOString();
  const item: RuntimeImprovementItem = {
    improvement_id: `impr_${crypto.randomUUID().slice(0, 8)}`,
    source_trace_id: approvedRequest.trace_id,
    source_approval_id: approvedRequest.approval_id,
    proposal_type: approvedRequest.type,
    priority: (approvedRequest.severity as ImprovementPriority) || "medium",
    title: approvedRequest.title,
    description: approvedRequest.description,
    status: "backlog",
    evidence_refs: [],
    approved_by: approvedRequest.decided_by || "unknown",
    created_at: now,
    updated_at: now,
  };

  items.push(item);
  writeAllImprovements(items);

  appendEvidenceRecord({
    evidence_id: hashTraceId(item.improvement_id, "runtime_improvement_registered"),
    trace_id: approvedRequest.trace_id,
    job_id: approvedRequest.source_job_id,
    type: "runtime_improvement_registered",
    timestamp: now,
    payload: {
      improvement_id: item.improvement_id,
      source_approval_id: approvedRequest.approval_id,
      proposal_type: item.proposal_type,
      priority: item.priority,
      status: item.status,
    },
  });

  return item;
}

export function updateImprovementStatus(
  improvementId: string,
  newStatus: ImprovementStatus,
): RuntimeImprovementItem | null {
  const items = readAllImprovements();
  const idx = items.findIndex((i) => i.improvement_id === improvementId);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  items[idx].status = newStatus;
  items[idx].updated_at = now;
  writeAllImprovements(items);

  appendEvidenceRecord({
    evidence_id: hashTraceId(improvementId, "runtime_improvement_status_changed"),
    trace_id: items[idx].source_trace_id,
    job_id: improvementId,
    type: "runtime_improvement_status_changed",
    timestamp: now,
    payload: {
      improvement_id: improvementId,
      previous_status: items[idx].status,
      new_status: newStatus,
    },
  });

  return items[idx];
}

export function listImprovements(
  status?: ImprovementStatus,
): RuntimeImprovementItem[] {
  const items = readAllImprovements();
  if (status) {
    return items.filter((i) => i.status === status);
  }
  return items;
}

export function registerAllApprovedProposals(): RuntimeImprovementItem[] {
  const approvals = readAllLearningApprovals();
  const approved = approvals.filter((r) => r.status === "approved");
  const registered: RuntimeImprovementItem[] = [];

  for (const a of approved) {
    const item = registerImprovementFromApproval(a);
    if (item) registered.push(item);
  }

  return registered;
}
