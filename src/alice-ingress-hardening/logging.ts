// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Safe Logging
//
// Log only safe metadata:
// - ids, outcomes, reasons, timings, bounded diagnostic hints
//
// Never log:
// - full raw payload, dangerous body dumps, secrets, sensitive content
// ─────────────────────────────────────────────────────────────

import type { AliceIngressObservabilityEvent } from "./types.js";

// Fields that are safe to log
const SAFE_LOG_FIELDS = new Set([
  "eventId",
  "eventType",
  "timestamp",
  "sessionId",
  "requestId",
  "outcome",
  "reason",
  "statusCode",
  "fingerprintId",
  "requestHash",
  "durationMs",
  "auditId",
]);

export function sanitizeIngressLogMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (SAFE_LOG_FIELDS.has(key)) {
      sanitized[key] = value;
    } else if (typeof value === "string" && value.length > 100) {
      // Truncate long strings
      sanitized[key] = value.slice(0, 100) + "...[truncated]";
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
    // Skip objects/arrays — too dangerous to log raw
  }

  return sanitized;
}

export function logIngressEventSafe(event: AliceIngressObservabilityEvent): void {
  const safeMeta = sanitizeIngressLogMeta(event.safeMeta ?? {});

  // Safe structured log — no raw payloads
  const logEntry = {
    source: "alice-ingress",
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.timestamp,
    sessionId: event.sessionId,
    requestId: event.requestId,
    meta: safeMeta,
  };

  // In production, this would go to a structured logging system
  // For v1, we keep it in-memory safe
  _safeLog.push(logEntry);

  // Bounded log size
  if (_safeLog.length > 1000) {
    _safeLog.length = 1000;
  }
}

const _safeLog: Record<string, unknown>[] = [];

export function getSafeLogEntries(limit: number = 100): Record<string, unknown>[] {
  return _safeLog.slice(0, Math.min(limit, 1000));
}

export function getSafeLogStats(): { total: number; max: number } {
  return { total: _safeLog.length, max: 1000 };
}
