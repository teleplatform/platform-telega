// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE VIEWS v1
//
// Operator-ready views built from raw records.
// Not Telegram-specific formatting yet.
// ─────────────────────────────────────────────────────────────
import { getRecentEvidence, getFailedEvidence, getBlockedEvidence, getSuccessfulEvidence, getEvidenceByInvocationId, getEvidenceByUser, getEvidenceByTarget, getEvidenceByKind, getEvidenceStats, } from "./forge-evidence-retrieval.js";
function recordToListItem(record, index) {
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
function recordToDetailView(record) {
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
export async function buildRecentEvidenceView(limit = 10) {
    const records = await getRecentEvidence(limit);
    return records.map((r, i) => recordToListItem(r, i + 1));
}
export async function buildFailedEvidenceView(limit = 10) {
    const records = await getFailedEvidence(limit);
    return records.map((r, i) => recordToListItem(r, i + 1));
}
export async function buildBlockedEvidenceView(limit = 10) {
    const records = await getBlockedEvidence(limit);
    return records.map((r, i) => recordToListItem(r, i + 1));
}
export async function buildSuccessfulEvidenceView(limit = 10) {
    const records = await getSuccessfulEvidence(limit);
    return records.map((r, i) => recordToListItem(r, i + 1));
}
export async function buildInvocationDetailView(invocationId) {
    const record = await getEvidenceByInvocationId(invocationId);
    if (!record)
        return null;
    return recordToDetailView(record);
}
export async function buildUserEvidenceView(userId, limit = 10) {
    const records = await getEvidenceByUser(userId, limit);
    return records.map((r, i) => recordToListItem(r, i + 1));
}
export async function buildTargetEvidenceView(target, limit = 10) {
    const records = await getEvidenceByTarget(target, limit);
    return records.map((r, i) => recordToListItem(r, i + 1));
}
export async function buildKindEvidenceView(kind, limit = 10) {
    const records = await getEvidenceByKind(kind, limit);
    return records.map((r, i) => recordToListItem(r, i + 1));
}
export async function buildEvidenceStatsView() {
    return getEvidenceStats();
}
