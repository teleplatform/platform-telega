// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE QUERY v1
//
// Query layer for evidence records.
// Provides filtered queries without export logic.
// ─────────────────────────────────────────────────────────────

import type { ForgeEvidenceQuery } from "./forge-evidence-export.types.js";
import type { ForgeInvocationEvidenceRecord } from "./forge-invocation-evidence.types.js";
import {
  listEvidenceFromStore,
  getEvidenceByInvocationId,
  getEvidenceByTaskId,
  getEvidenceCount,
} from "./forge-evidence-store.js";

export async function queryEvidence(
  query: ForgeEvidenceQuery,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listEvidenceFromStore(query);
}

export async function listEvidenceByUser(
  userId: string,
  limit?: number,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listEvidenceFromStore({ userId, limit, orderBy: "startedAt", order: "desc" });
}

export async function listEvidenceByTask(
  taskId: string,
): Promise<ForgeInvocationEvidenceRecord | null> {
  return getEvidenceByTaskId(taskId);
}

export async function listEvidenceByStatus(
  status: string,
  limit?: number,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listEvidenceFromStore({ status, limit, orderBy: "startedAt", order: "desc" });
}

export async function listEvidenceTimeline(
  options?: {
    limit?: number;
    after?: string;
    before?: string;
  },
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listEvidenceFromStore({
    startedAfter: options?.after,
    startedBefore: options?.before,
    limit: options?.limit || 50,
    orderBy: "startedAt",
    order: "desc",
  });
}

export async function listBlockedEvidence(
  limit?: number,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listEvidenceFromStore({ status: "blocked", limit, orderBy: "startedAt", order: "desc" });
}

export async function listFailedEvidence(
  limit?: number,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listEvidenceFromStore({ status: "failed", limit, orderBy: "startedAt", order: "desc" });
}

export async function listSuccessfulEvidence(
  limit?: number,
): Promise<ForgeInvocationEvidenceRecord[]> {
  return listEvidenceFromStore({ status: "done", limit, orderBy: "startedAt", order: "desc" });
}

export async function getEvidenceStats(): Promise<{
  total: number;
  done: number;
  failed: number;
  blocked: number;
  started: number;
}> {
  const all = await listEvidenceFromStore();
  
  let done = 0;
  let failed = 0;
  let blocked = 0;
  let started = 0;

  for (const record of all) {
    switch (record.status) {
      case "done":
        done++;
        break;
      case "failed":
        failed++;
        break;
      case "blocked":
        blocked++;
        break;
      case "started":
        started++;
        break;
    }
  }

  return { total: all.length, done, failed, blocked, started };
}