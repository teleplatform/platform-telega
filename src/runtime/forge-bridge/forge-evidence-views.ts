// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE VIEWS v1
//
// Operator-ready views built from raw records.
// Not Telegram-specific formatting yet.
// ─────────────────────────────────────────────────────────────

import type { ForgeInvocationEvidenceRecord } from "./forge-invocation-evidence.types.js";
import {
  getRecentEvidence,
  getFailedEvidence,
  getBlockedEvidence,
  getSuccessfulEvidence,
  getEvidenceByInvocationId,
  getEvidenceByUser,
  getEvidenceByTarget,
  getEvidenceByKind,
  getEvidenceStats,
} from "./forge-evidence-retrieval.js";

export interface ForgeEvidenceListItem {
  index: number;
  invocationId: string;
  taskId: string;
  status: string;
  target: string;
  kind: string;
  summary: string;
  startedAt: string;
  finishedAt?: string;
}

export interface ForgeEvidenceDetailView {
  invocationId: string;
  taskId: string;
  traceId?: string;
  userId: string;
  role: string;
  chatId?: string;
  action: string;
  target: string;
  kind: string;
  adapter?: string;
  status: string;
  summary: string;
  renderedText?: string;
  blockedReason?: string;
  errorCode?: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface ForgeEvidenceStatsView {
  total: number;
  done: number;
  failed: number;
  blocked: number;
  started: number;
}

function recordToListItem(record: ForgeInvocationEvidenceRecord, index: number): ForgeEvidenceListItem {
  return {
    index,
    invocationId: record.invocationId,
    taskId: record.taskId,
    status: record.status,
    target: record.target,
    kind: record.kind,
    summary: record.summary,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  };
}

function recordToDetailView(record: ForgeInvocationEvidenceRecord): ForgeEvidenceDetailView {
  return {
    invocationId: record.invocationId,
    taskId: record.taskId,
    traceId: record.traceId,
    userId: record.userId,
    role: record.role,
    chatId: record.chatId,
    action: record.action,
    target: record.target,
    kind: record.kind,
    adapter: record.adapter,
    status: record.status,
    summary: record.summary,
    renderedText: record.renderedText,
    blockedReason: record.blockedReason,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  };
}

export async function buildRecentEvidenceView(
  limit: number = 10,
): Promise<ForgeEvidenceListItem[]> {
  const records = await getRecentEvidence(limit);
  return records.map((r, i) => recordToListItem(r, i + 1));
}

export async function buildFailedEvidenceView(
  limit: number = 10,
): Promise<ForgeEvidenceListItem[]> {
  const records = await getFailedEvidence(limit);
  return records.map((r, i) => recordToListItem(r, i + 1));
}

export async function buildBlockedEvidenceView(
  limit: number = 10,
): Promise<ForgeEvidenceListItem[]> {
  const records = await getBlockedEvidence(limit);
  return records.map((r, i) => recordToListItem(r, i + 1));
}

export async function buildSuccessfulEvidenceView(
  limit: number = 10,
): Promise<ForgeEvidenceListItem[]> {
  const records = await getSuccessfulEvidence(limit);
  return records.map((r, i) => recordToListItem(r, i + 1));
}

export async function buildInvocationDetailView(
  invocationId: string,
): Promise<ForgeEvidenceDetailView | null> {
  const record = await getEvidenceByInvocationId(invocationId);
  if (!record) return null;
  return recordToDetailView(record);
}

export async function buildUserEvidenceView(
  userId: string,
  limit: number = 10,
): Promise<ForgeEvidenceListItem[]> {
  const records = await getEvidenceByUser(userId, limit);
  return records.map((r, i) => recordToListItem(r, i + 1));
}

export async function buildTargetEvidenceView(
  target: string,
  limit: number = 10,
): Promise<ForgeEvidenceListItem[]> {
  const records = await getEvidenceByTarget(target, limit);
  return records.map((r, i) => recordToListItem(r, i + 1));
}

export async function buildKindEvidenceView(
  kind: string,
  limit: number = 10,
): Promise<ForgeEvidenceListItem[]> {
  const records = await getEvidenceByKind(kind, limit);
  return records.map((r, i) => recordToListItem(r, i + 1));
}

export async function buildEvidenceStatsView(): Promise<ForgeEvidenceStatsView> {
  return getEvidenceStats();
}