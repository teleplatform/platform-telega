// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE QUERY v1
//
// Query layer for evidence records.
// Provides filtered queries without export logic.
// ─────────────────────────────────────────────────────────────
import { listEvidenceFromStore, getEvidenceByTaskId, } from "./forge-evidence-store.js";
export async function queryEvidence(query) {
    return listEvidenceFromStore(query);
}
export async function listEvidenceByUser(userId, limit) {
    return listEvidenceFromStore({ userId, limit, orderBy: "startedAt", order: "desc" });
}
export async function listEvidenceByTask(taskId) {
    return getEvidenceByTaskId(taskId);
}
export async function listEvidenceByStatus(status, limit) {
    return listEvidenceFromStore({ status, limit, orderBy: "startedAt", order: "desc" });
}
export async function listEvidenceTimeline(options) {
    return listEvidenceFromStore({
        startedAfter: options?.after,
        startedBefore: options?.before,
        limit: options?.limit || 50,
        orderBy: "startedAt",
        order: "desc",
    });
}
export async function listBlockedEvidence(limit) {
    return listEvidenceFromStore({ status: "blocked", limit, orderBy: "startedAt", order: "desc" });
}
export async function listFailedEvidence(limit) {
    return listEvidenceFromStore({ status: "failed", limit, orderBy: "startedAt", order: "desc" });
}
export async function listSuccessfulEvidence(limit) {
    return listEvidenceFromStore({ status: "done", limit, orderBy: "startedAt", order: "desc" });
}
export async function getEvidenceStats() {
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
