// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Observability
//
// Separate ingress observability stream:
// - ingress_received, verified, rejected, replayed, rate_limited, forwarded, failed
//
// Suitable for trace, monitoring, operator visibility.
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { AliceIngressObservabilityEvent } from "./types.js";
import { logIngressEventSafe } from "./logging.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildIngressObservabilityEvent(input: {
  eventType: AliceIngressObservabilityEvent["eventType"];
  sessionId?: string;
  requestId?: string;
  safeMeta?: Record<string, unknown>;
}): AliceIngressObservabilityEvent {
  return {
    eventId: crypto.randomUUID(),
    eventType: input.eventType,
    timestamp: nowIso(),
    sessionId: input.sessionId,
    requestId: input.requestId,
    safeMeta: input.safeMeta,
  };
}

export function emitIngressObservabilityEvent(event: AliceIngressObservabilityEvent): void {
  // Log safely — no raw payloads
  logIngressEventSafe(event);

  // Store in bounded observability buffer
  _observabilityBuffer.push(event);

  // Bounded buffer size
  if (_observabilityBuffer.length > 2000) {
    _observabilityBuffer.length = 2000;
  }
}

const _observabilityBuffer: AliceIngressObservabilityEvent[] = [];

export function getRecentObservabilityEvents(limit: number = 100): AliceIngressObservabilityEvent[] {
  return _observabilityBuffer.slice(0, Math.min(limit, 2000));
}

export function getObservabilityStats(): { total: number; max: number } {
  return { total: _observabilityBuffer.length, max: 2000 };
}
