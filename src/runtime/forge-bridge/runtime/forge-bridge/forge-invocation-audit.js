// ─────────────────────────────────────────────────────────────
// FORGE INVOCATION AUDIT v1
//
// Audit line builder for evidence records.
// Generates loggable audit lines for observability.
// ─────────────────────────────────────────────────────────────
export function buildForgeInvocationAuditLine(record) {
    const parts = [
        `[ForgeInvoke]`,
        `status=${record.status}`,
        `userId=${record.userId}`,
        `role=${record.role}`,
        `target=${record.target}`,
        `kind=${record.kind}`,
        `taskId=${record.taskId}`,
        `invocationId=${record.invocationId}`,
    ];
    if (record.chatId) {
        parts.push(`chatId=${record.chatId}`);
    }
    if (record.adapter) {
        parts.push(`adapter=${record.adapter}`);
    }
    if (record.blockedReason) {
        parts.push(`blockedReason=${record.blockedReason}`);
    }
    if (record.errorCode) {
        parts.push(`errorCode=${record.errorCode}`);
    }
    if (record.traceId) {
        parts.push(`traceId=${record.traceId}`);
    }
    return parts.join(" ");
}
export function buildForgeInvocationSummaryLine(record) {
    const statusEmoji = getStatusEmoji(record.status);
    const duration = calculateDuration(record.startedAt, record.finishedAt);
    return `${statusEmoji} ${record.summary} [${record.status}] ${record.action} → ${record.target} (${duration})`;
}
export function getStatusEmoji(status) {
    switch (status) {
        case "started":
            return "⏳";
        case "done":
            return "✅";
        case "partial":
            return "⚠️";
        case "blocked":
            return "⛔";
        case "failed":
            return "❌";
        default:
            return "❓";
    }
}
function calculateDuration(startedAt, finishedAt) {
    if (!finishedAt)
        return "pending";
    const start = new Date(startedAt).getTime();
    const end = new Date(finishedAt).getTime();
    const ms = end - start;
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}
export function formatEvidenceForExport(record) {
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
        status: record.status,
        summary: record.summary,
        renderedText: record.renderedText,
        blockedReason: record.blockedReason,
        errorCode: record.errorCode,
        errorMessage: record.errorMessage,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        duration: calculateDuration(record.startedAt, record.finishedAt),
    };
}
