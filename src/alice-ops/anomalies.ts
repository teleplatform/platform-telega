// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Anomaly Detection
//
// Bounded anomaly detection layer.
// Detects: ingress_unreachable, protocol_failure, bridge_failure,
//          unsafe_response_path, repeated_fallback, unknown
//
// Signals don't auto-repair — they truthfully record and affect health/state.
// ─────────────────────────────────────────────────────────────

import type {
  AliceAnomalySignal,
  AliceLiveHealthSnapshot,
  AliceLiveOperationalState,
} from "./types.js";
import { buildAliceAnomalySignal } from "./signals.js";

export type AnomalyDetectionInput = {
  ingressReachable?: boolean;
  protocolHealthy?: boolean;
  bridgeHealthy?: boolean;
  safeResponsePathUsed?: boolean;
  repeatedFallbackCount?: number;
};

export function detectAliceOperationalAnomalies(
  input: AnomalyDetectionInput,
): AliceAnomalySignal[] {
  const signals: AliceAnomalySignal[] = [];

  // Check ingress unreachable
  if (input.ingressReachable === false) {
    signals.push(
      buildAliceAnomalySignal({
        severity: "high",
        type: "ingress_unreachable",
        notes: ["Ingress endpoint is unreachable from external surface"],
      }),
    );
  }

  // Check protocol failure
  if (input.protocolHealthy === false) {
    signals.push(
      buildAliceAnomalySignal({
        severity: "high",
        type: "protocol_failure",
        notes: ["Protocol adapter failed to process requests"],
      }),
    );
  }

  // Check bridge failure
  if (input.bridgeHealthy === false) {
    signals.push(
      buildAliceAnomalySignal({
        severity: "high",
        type: "bridge_failure",
        notes: ["Bridge adapter failed to handle voice session"],
      }),
    );
  }

  // Check unsafe response path
  if (input.safeResponsePathUsed === true) {
    signals.push(
      buildAliceAnomalySignal({
        severity: "medium",
        type: "unsafe_response_path",
        notes: ["Response path may leak internal details or behave unsafely"],
      }),
    );
  }

  // Check repeated fallback (threshold: 3+)
  const fallbackCount = input.repeatedFallbackCount ?? 0;
  if (fallbackCount >= 3) {
    signals.push(
      buildAliceAnomalySignal({
        severity: "medium",
        type: "repeated_fallback",
        notes: [`Repeated fallback usage detected (${fallbackCount} times) — possible degraded operation`],
      }),
    );
  }

  return signals;
}

export function hasCriticalAnomalies(signals: AliceAnomalySignal[]): boolean {
  return signals.some((s) => s.severity === "high");
}

export function hasMediumAnomalies(signals: AliceAnomalySignal[]): boolean {
  return signals.some((s) => s.severity === "medium");
}

export function getAnomalyCount(signals: AliceAnomalySignal[]): { high: number; medium: number; low: number } {
  return {
    high: signals.filter((s) => s.severity === "high").length,
    medium: signals.filter((s) => s.severity === "medium").length,
    low: signals.filter((s) => s.severity === "low").length,
  };
}

export function getHealthImpactFromAnomalies(
  signals: AliceAnomalySignal[],
): AliceLiveHealthSnapshot["health"] {
  if (hasCriticalAnomalies(signals)) {
    return "unknown"; // Critical anomalies → health indeterminate
  }
  if (hasMediumAnomalies(signals)) {
    return "degraded"; // Medium anomalies → degraded but available
  }
  return "healthy"; // No anomalies → healthy
}

export function getStateImpactFromAnomalies(
  signals: AliceAnomalySignal[],
  currentState: AliceLiveOperationalState["state"],
): AliceLiveOperationalState["state"] {
  if (currentState === "held" || currentState === "disabled") {
    return currentState; // Hold/disable takes precedence over anomalies
  }

  if (hasCriticalAnomalies(signals)) {
    return "degraded"; // Critical anomalies → degrade state
  }

  if (hasMediumAnomalies(signals)) {
    return "degraded"; // Medium anomalies → degrade state
  }

  return currentState === "unknown" ? "unknown" : "live";
}
