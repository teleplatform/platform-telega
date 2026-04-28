// ─────────────────────────────────────────────────────────────
// FORGE INVOCATION EVIDENCE STORE v1
//
// In-memory store for Forge invocation evidence.
// ONE source of truth for execution records.
//
// Operations:
// - createInvocationEvidence (insert new)
// - updateInvocationEvidence (patch terminal state)
// - getInvocationEvidence (lookup by id)
// - listInvocationEvidence (all records)
// - findInvocationEvidenceByTaskId (lookup by task)
// - findInvocationEvidenceByUserId (lookup by user)
// - clearInvocationEvidence (testing)
// ─────────────────────────────────────────────────────────────

import type {
  ForgeInvocationEvidenceRecord,
  ForgeInvocationStatus,
  ForgeInvocationEvidenceSnapshot,
} from "./forge-invocation-evidence.types.js";

const evidenceStore = new Map<string, ForgeInvocationEvidenceRecord>();

const TASK_INDEX = new Map<string, string>();
const USER_INDEX = new Map<string, string[]>();

export function createInvocationEvidence(
  record: ForgeInvocationEvidenceRecord,
): ForgeInvocationEvidenceRecord {
  evidenceStore.set(record.invocationId, record);
  TASK_INDEX.set(record.taskId, record.invocationId);

  const userList = USER_INDEX.get(record.userId) || [];
  userList.push(record.invocationId);
  USER_INDEX.set(record.userId, userList);

  console.log(
    `[evidence] created: invocationId=${record.invocationId} taskId=${record.taskId} status=${record.status}`,
  );

  return record;
}

export function updateInvocationEvidence(
  invocationId: string,
  patch: Partial<ForgeInvocationEvidenceRecord>,
): ForgeInvocationEvidenceRecord | null {
  const current = evidenceStore.get(invocationId);
  if (!current) {
    console.warn(`[evidence] update failed: invocationId=${invocationId} not found`);
    return null;
  }

  const next: ForgeInvocationEvidenceRecord = {
    ...current,
    ...patch,
  };

  evidenceStore.set(invocationId, next);

  console.log(
    `[evidence] updated: invocationId=${invocationId} status=${next.status} summary=${next.summary}`,
  );

  return next;
}

export function updateInvocationEvidenceByTaskId(
  taskId: string,
  patch: Partial<ForgeInvocationEvidenceRecord>,
): ForgeInvocationEvidenceRecord | null {
  const invocationId = TASK_INDEX.get(taskId);
  if (!invocationId) {
    console.warn(`[evidence] update failed: taskId=${taskId} not found`);
    return null;
  }

  return updateInvocationEvidence(invocationId, patch);
}

export function getInvocationEvidence(
  invocationId: string,
): ForgeInvocationEvidenceRecord | null {
  return evidenceStore.get(invocationId) || null;
}

export function getInvocationEvidenceSnapshot(
  invocationId: string,
): ForgeInvocationEvidenceSnapshot | null {
  const record = evidenceStore.get(invocationId);
  if (!record) return null;

  return {
    invocationId: record.invocationId,
    taskId: record.taskId,
    status: record.status,
    summary: record.summary,
    renderedText: record.renderedText,
    finishedAt: record.finishedAt,
  };
}

export function listInvocationEvidence(): ForgeInvocationEvidenceRecord[] {
  return Array.from(evidenceStore.values());
}

export function findInvocationEvidenceByTaskId(
  taskId: string,
): ForgeInvocationEvidenceRecord | null {
  const invocationId = TASK_INDEX.get(taskId);
  if (!invocationId) return null;
  return evidenceStore.get(invocationId) || null;
}

export function findInvocationEvidenceByUserId(
  userId: string,
): ForgeInvocationEvidenceRecord[] {
  const invocationIds = USER_INDEX.get(userId) || [];
  return invocationIds
    .map((id) => evidenceStore.get(id))
    .filter((r): r is ForgeInvocationEvidenceRecord => r !== undefined);
}

export function findInvocationEvidenceByStatus(
  status: ForgeInvocationStatus,
): ForgeInvocationEvidenceRecord[] {
  return Array.from(evidenceStore.values()).filter((r) => r.status === status);
}

export function clearInvocationEvidence(): void {
  evidenceStore.clear();
  TASK_INDEX.clear();
  USER_INDEX.clear();
  console.log(`[evidence] store cleared`);
}

export function getEvidenceStoreSize(): number {
  return evidenceStore.size;
}

export function buildEvidenceFromInvocation(
  params: {
    userId: string;
    chatId?: string;
    action: string;
    target: string;
    kind: string;
    adapter?: string;
  },
  taskId: string,
): ForgeInvocationEvidenceRecord {
  const invocationId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const role = "owner_runtime";

  return {
    invocationId,
    taskId,
    userId: params.userId,
    role,
    chatId: params.chatId,
    action: params.action,
    target: params.target,
    kind: params.kind,
    adapter: params.adapter,
    status: "started" as ForgeInvocationStatus,
    summary: "Forge invocation started",
    startedAt: new Date().toISOString(),
  };
}