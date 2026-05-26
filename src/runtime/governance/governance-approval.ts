import type { ApprovalRequest } from "./governance-types.js";

const approvalQueue: ApprovalRequest[] = [];
const MAX_APPROVAL_QUEUE = 50;

function generateApprovalId(): string {
  return `apr_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function requestApproval(
  taskId: string,
  actionId: string,
  actionLabel: string,
  actionType: string,
  risk: "high" | "critical",
  reason: string,
  params: Record<string, unknown>,
): ApprovalRequest {
  const request: ApprovalRequest = {
    id: generateApprovalId(),
    taskId,
    actionId,
    actionLabel,
    actionType,
    risk,
    reason,
    params,
    requestedAt: Date.now(),
    status: "pending",
  };
  approvalQueue.push(request);
  if (approvalQueue.length > MAX_APPROVAL_QUEUE) approvalQueue.shift();
  return request;
}

export function approveAction(approvalId: string, decidedBy = "auto"): ApprovalRequest | undefined {
  const req = approvalQueue.find(r => r.id === approvalId);
  if (!req) return undefined;
  req.status = "approved";
  req.decidedAt = Date.now();
  req.decidedBy = decidedBy;
  return { ...req };
}

export function rejectAction(approvalId: string, decidedBy = "auto"): ApprovalRequest | undefined {
  const req = approvalQueue.find(r => r.id === approvalId);
  if (!req) return undefined;
  req.status = "rejected";
  req.decidedAt = Date.now();
  req.decidedBy = decidedBy;
  return { ...req };
}

export function getPendingApprovals(): ApprovalRequest[] {
  return approvalQueue.filter(r => r.status === "pending");
}

export function getApproval(approvalId: string): ApprovalRequest | undefined {
  return approvalQueue.find(r => r.id === approvalId);
}

export function getApprovalsForTask(taskId: string): ApprovalRequest[] {
  return approvalQueue.filter(r => r.taskId === taskId);
}

export function approvalQueueSummary(): string {
  const pending = getPendingApprovals();
  if (pending.length === 0) return "No pending approvals.";
  const lines = pending.map((r, i) =>
    `  ${i + 1}. [${r.risk}] ${r.actionLabel} (${r.actionType}) — ${r.reason}`
  );
  return `Pending approvals: ${pending.length}\n${lines.join("\n")}`;
}
