// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Severity
//
// Bounded severity resolution based on:
// - anomaly type
// - health impact
// - fallback overuse
// - operator/manual escalation
// ─────────────────────────────────────────────────────────────

import type { AliceIncidentSeverity, AliceAnomalySignal, AliceLiveHealthSnapshot } from "../alice-ops/types.js";

export function resolveAliceIncidentSeverity(input: {
  anomalySignals?: AliceAnomalySignal[];
  healthImpact?: AliceLiveHealthSnapshot["health"];
  isManualEscalation?: boolean;
}): AliceIncidentSeverity {
  const signals = input.anomalySignals ?? [];
  const hasCriticalAnomalies = signals.some((s) => s.severity === "high");
  const hasMediumAnomalies = signals.some((s) => s.severity === "medium");
  const healthImpact = input.healthImpact ?? "unknown";
  const isManualEscalation = input.isManualEscalation ?? false;

  // Determine severity
  let severity: AliceIncidentSeverity["severity"] = "low";
  let reason = "";

  if (isManualEscalation) {
    severity = "high";
    reason = "Manual operator escalation";
  } else if (hasCriticalAnomalies) {
    severity = "critical";
    reason = "Critical anomaly detected — immediate attention required";
  } else if (healthImpact === "unknown") {
    severity = "high";
    reason = "Health indeterminate — system state unknown";
  } else if (hasMediumAnomalies) {
    severity = "medium";
    reason = "Medium anomaly detected — operator review advised";
  } else if (signals.length > 0) {
    severity = "low";
    reason = `Low severity anomalies detected (${signals.length} signal(s))`;
  } else {
    severity = "low";
    reason = "No anomalies detected — low severity baseline";
  }

  return {
    severity,
    reason,
    notes: [`Anomaly count: ${signals.length}`, `Health impact: ${healthImpact}`],
  };
}

export function getSeverityDescription(severity: AliceIncidentSeverity["severity"]): string {
  switch (severity) {
    case "low":
      return "Low severity — monitoring recommended, no immediate action required";
    case "medium":
      return "Medium severity — operator review advised, potential degradation";
    case "high":
      return "High severity — immediate attention required, system may be compromised";
    case "critical":
      return "Critical severity — emergency response needed, system integrity at risk";
    default:
      return `Unknown severity: ${severity}`;
  }
}
