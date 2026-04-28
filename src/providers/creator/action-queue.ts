import fs from "fs/promises";
import path from "path";

const TELEGA_DIR = path.join(process.cwd(), "data", "telega");
const ACTION_QUEUE_FILE = path.join(TELEGA_DIR, "action-queue.jsonl");
const APPROVAL_LOG_FILE = path.join(TELEGA_DIR, "approval-log.jsonl");

export type ActionType = "product_card_update" | "seller_reply" | "market_research_report" | "content_post" | "story_post" | "ops_report";
export type ActionStatus = "pending" | "approved" | "rejected" | "delivered" | "expired";

export interface Action {
  action_id: string;
  workflow_id?: string;
  action_type: ActionType;
  user_id: string;
  title: string;
  content: string;
  metadata: {
    before?: string;
    after?: string;
    preview?: string;
    evidence_ids?: string[];
    provider?: string;
    quality_score?: number;
    language?: string;
  };
  status: ActionStatus;
  created_at: number;
  reviewed_at?: number;
  reviewed_by?: string;
  rejection_reason?: string;
  delivered_at?: number;
}

export interface ApprovalLog {
  log_id: string;
  action_id: string;
  user_id: string;
  action: "approve" | "reject";
  reason?: string;
  timestamp: number;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TELEGA_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function appendAction(action: Action): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(action) + "\n";
    await fs.appendFile(ACTION_QUEUE_FILE, line, "utf-8");
  } catch (e) {
    console.error("[telega-action] write failed", e);
  }
}

export async function appendApprovalLog(log: ApprovalLog): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(log) + "\n";
    await fs.appendFile(APPROVAL_LOG_FILE, line, "utf-8");
  } catch (e) {
    console.error("[telega-action] approval log failed", e);
  }
}

export async function loadActions(userId?: string, status?: ActionStatus, limit = 20): Promise<Action[]> {
  const actions: Action[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(ACTION_QUEUE_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit * 2);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.action_id) {
          if (userId && parsed.user_id !== userId) continue;
          if (status && parsed.status !== status) continue;
          actions.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return actions.sort((a, b) => b.created_at - a.created_at);
}

export async function getAction(actionId: string): Promise<Action | null> {
  const actions = await loadActions(undefined, undefined, 100);
  return actions.find(a => a.action_id === actionId) || null;
}

export async function createAction(
  userId: string,
  actionType: ActionType,
  title: string,
  content: string,
  metadata: Action["metadata"] = {},
  workflowId?: string
): Promise<Action> {
  const action: Action = {
    action_id: makeId("act"),
    workflow_id: workflowId,
    action_type: actionType,
    user_id: userId,
    title,
    content,
    metadata,
    status: "pending",
    created_at: Date.now(),
  };
  await appendAction(action);
  return action;
}

export async function approveAction(
  actionId: string,
  reviewerId: string,
  reason?: string
): Promise<boolean> {
  const action = await getAction(actionId);
  if (!action) return false;
  if (action.status !== "pending") return false;
  
  action.status = "approved";
  action.reviewed_at = Date.now();
  action.reviewed_by = reviewerId;
  
  await appendAction(action);
  await appendApprovalLog({
    log_id: makeId("log"),
    action_id: actionId,
    user_id: reviewerId,
    action: "approve",
    reason,
    timestamp: Date.now(),
  });
  
  return true;
}

export async function rejectAction(
  actionId: string,
  reviewerId: string,
  reason: string
): Promise<boolean> {
  const action = await getAction(actionId);
  if (!action) return false;
  if (action.status !== "pending") return false;
  
  action.status = "rejected";
  action.reviewed_at = Date.now();
  action.reviewed_by = reviewerId;
  action.rejection_reason = reason;
  
  await appendAction(action);
  await appendApprovalLog({
    log_id: makeId("log"),
    action_id: actionId,
    user_id: reviewerId,
    action: "reject",
    reason,
    timestamp: Date.now(),
  });
  
  return true;
}

export async function markDelivered(actionId: string): Promise<boolean> {
  const action = await getAction(actionId);
  if (!action) return false;
  if (action.status !== "approved") return false;
  
  action.status = "delivered";
  action.delivered_at = Date.now();
  
  await appendAction(action);
  return true;
}

export function formatAction(action: Action): string {
  const statusEmoji: Record<ActionStatus, string> = {
    pending: "⏳",
    approved: "✅",
    rejected: "❌",
    delivered: "📤",
    expired: "⏰",
  };
  
  const lines = [
    `${statusEmoji[action.status]} Action: ${action.action_type}`,
    `ID: ${action.action_id}`,
    `${action.workflow_id ? `Workflow: ${action.workflow_id}` : ""}`,
    `Title: ${action.title}`,
    `User: ${action.user_id}`,
    `Created: ${new Date(action.created_at).toLocaleString()}`,
  ];
  
  if (action.status === "approved" || action.status === "rejected") {
    lines.push(`Reviewed: ${new Date(action.reviewed_at!).toLocaleString()}`);
    lines.push(`By: ${action.reviewed_by}`);
    if (action.rejection_reason) lines.push(`Reason: ${action.rejection_reason}`);
  }
  
  if (action.metadata.evidence_ids?.length) {
    lines.push(`Evidence: ${action.metadata.evidence_ids.join(", ")}`);
  }
  
  if (action.metadata.quality_score !== undefined) {
    lines.push(`Quality: ${action.metadata.quality_score}%`);
  }
  
  lines.push(`\n--- Content ---`);
  lines.push(action.content.slice(0, 500));
  if (action.content.length > 500) lines.push("...");
  
  return lines.filter(Boolean).join("\n");
}

export function formatActionList(actions: Action[]): string {
  if (actions.length === 0) return "No actions found";
  
  const statusEmoji: Record<ActionStatus, string> = {
    pending: "⏳",
    approved: "✅",
    rejected: "❌",
    delivered: "📤",
    expired: "⏰",
  };
  
  const lines = [`📋 Actions (${actions.length}):\n`];
  for (const a of actions.slice(0, 10)) {
    lines.push(`${statusEmoji[a.status]} ${a.action_type}: ${a.title.slice(0, 30)}...`);
    lines.push(`   ID: ${a.action_id} | ${new Date(a.created_at).toLocaleDateString()}`);
  }
  return lines.join("\n");
}

export async function loadApprovalLogs(actionId?: string, limit = 20): Promise<ApprovalLog[]> {
  const logs: ApprovalLog[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(APPROVAL_LOG_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.log_id) {
          if (!actionId || parsed.action_id === actionId) {
            logs.push(parsed);
          }
        }
      } catch {}
    }
  } catch {}
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

export function formatApprovalLog(log: ApprovalLog): string {
  const actionIcon = log.action === "approve" ? "✅" : "❌";
  const lines = [
    `${actionIcon} ${log.action.toUpperCase()}`,
    `Action: ${log.action_id}`,
    `By: ${log.user_id}`,
    `Time: ${new Date(log.timestamp).toLocaleString()}`,
  ];
  if (log.reason) lines.push(`Reason: ${log.reason}`);
  return lines.join("\n");
}

export function buildProductCardAction(
  userId: string,
  workflowId: string,
  before: string,
  after: { title: string; description: string; tags: string[]; category: string },
  qualityScore: number
): Action {
  const content = `📦 Product Card Update

BEFORE:
${before}

AFTER:
🎯 Title: ${after.title}
📝 Description: ${after.description}
🏷️ Tags: ${after.tags.join(", ")}
📂 Category: ${after.category}
⭐ Quality: ${qualityScore}%`;

  return {
    action_id: makeId("act"),
    workflow_id: workflowId,
    action_type: "product_card_update",
    user_id: userId,
    title: `Product Card: ${after.title.slice(0, 30)}`,
    content,
    metadata: { before, after: JSON.stringify(after), quality_score: qualityScore },
    status: "pending",
    created_at: Date.now(),
  };
}

export function buildContentAction(
  userId: string,
  workflowId: string,
  contentType: "post" | "story",
  content: string,
  preview: string,
  language: string = "ru"
): Action {
  const title = contentType === "post" ? `Post: ${preview.slice(0, 30)}` : `Story: ${preview.slice(0, 30)}`;
  
  return {
    action_id: makeId("act"),
    workflow_id: workflowId,
    action_type: contentType === "post" ? "content_post" : "story_post",
    user_id: userId,
    title,
    content,
    metadata: { preview, language },
    status: "pending",
    created_at: Date.now(),
  };
}

export function buildResearchAction(
  userId: string,
  workflowId: string,
  query: string,
  report: string,
  evidenceIds: string[],
  provider: string
): Action {
  const title = `Research: ${query.slice(0, 30)}`;
  
  return {
    action_id: makeId("act"),
    workflow_id: workflowId,
    action_type: "market_research_report",
    user_id: userId,
    title,
    content: report,
    metadata: { evidence_ids: evidenceIds, provider },
    status: "pending",
    created_at: Date.now(),
  };
}