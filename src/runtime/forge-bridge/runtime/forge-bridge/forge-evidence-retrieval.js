// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE RETRIEVAL v1
//
// Retrieval layer exposing filtered queries.
// Surface for evidence access (no export logic).
// ─────────────────────────────────────────────────────────────
import { listEvidenceFromStore, } from "./forge-evidence-store.js";
import { listEvidenceByUser, listEvidenceTimeline, listBlockedEvidence, listFailedEvidence, listSuccessfulEvidence, } from "./forge-evidence-query.js";
export async function getRecentEvidence(limit = 10) {
    return listEvidenceTimeline({ limit });
}
export async function getFailedEvidence(limit = 10) {
    return listFailedEvidence(limit);
}
export async function getBlockedEvidence(limit = 10) {
    return listBlockedEvidence(limit);
}
export async function getSuccessfulEvidence(limit = 10) {
    return listSuccessfulEvidence(limit);
}
export async function getEvidenceByInvocationId(invocationId) {
    const results = await listEvidenceFromStore({ invocationId, limit: 1 });
    return results[0] || null;
}
export async function getEvidenceByTaskId(taskId) {
    const results = await listEvidenceFromStore({ taskId, limit: 1 });
    return results[0] || null;
}
export async function getEvidenceByUser(userId, limit = 10) {
    return listEvidenceByUser(userId, limit);
}
export async function getEvidenceByTarget(target, limit = 10) {
    return listEvidenceFromStore({ target, limit, orderBy: "startedAt", order: "desc" });
}
export async function getEvidenceByKind(kind, limit = 10) {
    return listEvidenceFromStore({ kind, limit, orderBy: "startedAt", order: "desc" });
}
export async function getEvidenceStats() {
    return getEvidenceStats();
}
