// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Audit Trail
//
// Every ingress must truthfully leave an audit outcome:
// accepted, rejected, replayed, rate_limited, failed.
//
// This is a separate audit layer — not random console.log.
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { AliceIngressAuditRecord } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

// In-memory audit trail (bounded)
const _auditTrail: AliceIngressAuditRecord[] = [];
const _maxAuditTrailSize = 5000;

export function buildIngressAuditRecord(input: {
  requestId?: string;
  sessionId?: string;
  userId?: string;
  outcome: AliceIngressAuditRecord["outcome"];
  reason?: string;
  safeMeta?: Record<string, unknown>;
}): AliceIngressAuditRecord {
  return {
    auditId: crypto.randomUUID(),
    requestId: input.requestId,
    sessionId: input.sessionId,
    userId: input.userId,
    outcome: input.outcome,
    reason: input.reason,
    timestamp: nowIso(),
    safeMeta: input.safeMeta,
  };
}

export function recordIngressAudit(record: AliceIngressAuditRecord): void {
  _auditTrail.unshift(record);

  // Bounded trail size
  if (_auditTrail.length > _maxAuditTrailSize) {
    _auditTrail.length = _maxAuditTrailSize;
  }
}

export function getRecentAuditRecords(limit: number = 50): AliceIngressAuditRecord[] {
  return _auditTrail.slice(0, Math.min(limit, _maxAuditTrailSize));
}

export function getAuditTrailStats(): { total: number; max: number } {
  return { total: _auditTrail.length, max: _maxAuditTrailSize };
}
