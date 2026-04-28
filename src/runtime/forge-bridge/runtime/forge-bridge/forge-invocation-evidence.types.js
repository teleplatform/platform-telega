// ─────────────────────────────────────────────────────────────
// FORGE INVOCATION EVIDENCE TYPES v1
//
// Evidence record for every Forge invocation.
// Captures execution truth as first-class entity.
//
// Required fields for every invoke:
// - invocationId, taskId, userId, role
// - action, target, kind, status
// - summary, startedAt, finishedAt
//
// Optional fields:
// - renderedText (Telegram delivery)
// - blockedReason (blocked cases)
// - errorCode, errorMessage (failed cases)
// - traceId, chatId, adapter, metadata
// ─────────────────────────────────────────────────────────────
export {};
