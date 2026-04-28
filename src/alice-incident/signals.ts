// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Signal Classification
//
// Resolves incident from live signals (anomalies + health + live state).
// Determines if current situation warrants formal incident vs just issue.
// ─────────────────────────────────────────────────────────────

import type { AliceAnomalySignal, AliceLiveHealthSnapshot, AliceLiveOperationalState } from "../alice-ops/types.js";
import { buildAliceIncidentRecord } from "./incident.js";

export type IncidentClassificationResult = {
  isIncident: boolean;
  severity: "low" | "medium" | "high" | "critical";
  trigger: Parameters<typeof buildAliceIncidentRecord>[0]["trigger"];
  notes: string[];
};

export function resolveIncidentFromLiveSignals(input: {
  anomalySignals: AliceAnomalySignal[];
  health: AliceLiveHealthSnapshot;
  liveState: AliceLiveOperationalState;
}): IncidentClassificationResult {
  const signals = input.anomalySignals;
  const health = input.health;
  const liveState = input.liveState;

  // No anomalies, healthy, live → no incident
  if (signals.length === 0 && health.health === "healthy" && liveState.state === "live") {
    return {
      isIncident: false,
      severity: "low",
      trigger: "unknown",
      notes: ["No incident — system operating normally"],
    };
  }

  // Check for specific triggers
  const hasIngressFailure = signals.some((s) => s.type === "ingress_unreachable");
  const hasProtocolFailure = signals.some((s) => s.type === "protocol_failure");
  const hasBridgeFailure = signals.some((s) => s.type === "bridge_failure");
  const hasUnsafeResponse = signals.some((s) => s.type === "unsafe_response_path");
  const hasRepeatedFallback = signals.some((s) => s.type === "repeated_fallback");

  const hasCriticalAnomaly = signals.some((s) => s.severity === "high");

  // Determine trigger
  let trigger: IncidentClassificationResult["trigger"] = "unknown";
  if (hasIngressFailure) trigger = "ingress_failure";
  else if (hasProtocolFailure) trigger = "protocol_failure";
  else if (hasBridgeFailure) trigger = "bridge_failure";
  else if (hasUnsafeResponse) trigger = "unsafe_response_path";
  else if (hasRepeatedFallback) trigger = "repeated_fallback";

  // Determine if this is a formal incident
  const isIncident = hasCriticalAnomaly || health.health === "unknown" || liveState.state === "disabled";

  // Determine severity
  let severity: IncidentClassificationResult["severity"] = "low";
  if (hasCriticalAnomaly) severity = "critical";
  else if (health.health === "unknown") severity = "high";
  else if (hasRepeatedFallback || hasUnsafeResponse) severity = "medium";
  else severity = "low";

  return {
    isIncident,
    severity,
    trigger,
    notes: [
      `Anomaly count: ${signals.length}`,
      `Health: ${health.health}`,
      `Live state: ${liveState.state}`,
    ],
  };
}
