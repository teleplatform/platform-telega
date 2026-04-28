// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE RETRIEVAL v1
//
// Retrieval layer exposing filtered queries.
// Surface for evidence access (no export logic).
// ────────────────────.──

import type { ForgeInvocationEvidenceRecord } from "./forge-invocation-evidence.types.js";
import {
  listEvidenceFromStore,
} from "./forge-evidence-store.js";
import {
  getEvidenceByInvocationId,
  getEvidenceByTaskId,
  listEvidenceByUser,
  listEvidenceByStatus,
  listEvidenceTimeline,
  listBlockedEvidence,
  listFailedEvidence,
  listSuccessfulEvidence,
  getEvidenceStats,
} from "./forge-evidence-query.js";

export async function getRecentEvidence(
  limit: number = 10,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listEvidenceTimeline({ limit });
}

export async function getFailedEvidence(
  limit: number = 10,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listFailedEvidence(limit);
}

export async function getBlockedEvidence(
  limit: number = 10,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listBlockedEvidence(limit);
}

export async function getSuccessfulEvidence(
  limit: number = 10,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listSuccessfulEvidence(limit);
}

export async function getEvidenceByInvocationId(
  invocationId: string,
): Promise<ForgeInvocationEvidenceRecord | null> {
  const results = await listEvidenceFromStore({ invocationId, limit: 1 });
  return results[0] || null;
}

export async function getEvidenceByTaskId(
  taskId: string,
): Promise<ForgeInvocationEvidenceRecord | null> {
  const results = await listEvidenceFromStore({ taskId, limit: 1 });
  return results[0] || null;
}

export async function getEvidenceByUser(
  userId: string,
  limit: number = 10,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listEvidenceByUser(userId, limit);
}

export async function getEvidenceByTarget(
  target: string,
  limit: number = 10,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listEvidenceFromStore({ target, limit, orderBy: "startedAt", order: "desc" });
}

export async function getEvidenceByKind(
  kind: string,
  limit: number = 10,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listEvidenceFromStore({ kind, limit, orderBy: "startedAt", order: "desc" });
}

export async function getEvidenceStats(): Promise<{
  total: number;
  done: number;
  failed: number;
  blocked: number;
  started: number;
}> {
  return getEvidenceStats();
}