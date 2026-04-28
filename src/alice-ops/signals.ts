// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Signals
//
// Bounded anomaly signal layer.
// Signals truthfully record anomalies but don't auto-repair.
// Types: ingress_unreachable, protocol_failure, bridge_failure,
//        unsafe_response_path, repeated_fallback, unknown
// Severities: low, medium, high
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { AliceAnomalySignal } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildAliceAnomalySignal(input: {
  severity: AliceAnomalySignal["severity"];
  type: AliceAnomalySignal["type"];
  notes?: string[];
}): AliceAnomalySignal {
  return {
    signalId: crypto.randomUUID(),
    severity: input.severity,
    type: input.type,
    observedAt: nowIso(),
    notes: input.notes,
  };
}

export function getAnomalyDescription(signal: AliceAnomalySignal): string {
  const typeDescriptions: Record<AliceAnomalySignal["type"], string> = {
    ingress_unreachable: "Ingress endpoint is unreachable from external surface",
    protocol_failure: "Protocol adapter failed to process request",
    bridge_failure: "Bridge adapter failed to handle voice session",
    unsafe_response_path: "Response path may leak internal details or behave unsafely",
    repeated_fallback: "Repeated fallback usage detected — possible degraded operation",
    unknown: "Unknown anomaly type — investigation needed",
  };

  const severityLabels: Record<AliceAnomalySignal["severity"], string> = {
    low: "Low severity — monitoring recommended",
    medium: "Medium severity — operator review advised",
    high: "High severity — immediate attention required",
  };

  return `${severityLabels[signal.severity]}: ${typeDescriptions[signal.type]}`;
}
