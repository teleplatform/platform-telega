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

export type ForgeInvocationStatus =
  | "started"
  | "done"
  | "partial"
  | "blocked"
  | "failed";

export interface ForgeInvocationEvidenceRecord {
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

  status: ForgeInvocationStatus;
  summary: string;
  renderedText?: string;

  blockedReason?: string;
  errorCode?: string;
  errorMessage?: string;

  startedAt: string;
  finishedAt?: string;

  metadata?: Record<string, unknown>;
}

export interface ForgeInvocationEvidenceSnapshot {
  invocationId: string;
  taskId: string;
  status: ForgeInvocationStatus;
  summary: string;
  renderedText?: string;
  finishedAt?: string;
}