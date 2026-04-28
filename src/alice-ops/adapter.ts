// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Main Handler
//
// prepareAliceLiveOperationsState() does ONLY:
// 1. build operational state
// 2. build health snapshot
// 3. detect anomalies
// 4. apply health/state impact from anomalies
// 5. build operator control decision
// 6. apply resulting state transition
// 7. never pretend healthy if degraded/held/disabled truth exists
// ─────────────────────────────────────────────────────────────

import type {
  AliceLiveOperationalState,
  AliceLiveHealthSnapshot,
  AliceAnomalySignal,
  AliceOperatorControlDecision,
} from "./types.js";
import { buildAliceLiveOperationalState } from "./state.js";
import { buildAliceLiveHealthSnapshot } from "./health.js";
import { detectAliceOperationalAnomalies, hasCriticalAnomalies, getStateImpactFromAnomalies } from "./anomalies.js";
import { buildAliceOperatorControlDecision } from "./controls.js";

export type LiveOpsPrepResult = {
  operationalState: AliceLiveOperationalState;
  health: AliceLiveHealthSnapshot;
  anomalies: AliceAnomalySignal[];
  controlDecision: AliceOperatorControlDecision;
  resultingState: AliceLiveOperationalState;
};

export function prepareAliceLiveOperationsState(input?: {
  currentState?: AliceLiveOperationalState["state"];
  healthInput?: {
    ingressAlive?: boolean;
    protocolAlive?: boolean;
    bridgeAlive?: boolean;
    safeFallbackAvailable?: boolean;
    warnings?: string[];
  };
  anomalyInput?: Parameters<typeof detectAliceOperationalAnomalies>[0];
  controlAction?: AliceOperatorControlDecision["action"];
  controlReason?: string;
}): LiveOpsPrepResult {
  const currentState = input?.currentState ?? "live";

  // 1. Build initial operational state
  const operationalState = buildAliceLiveOperationalState({
    state: currentState,
    source: "health",
    notes: ["Initial operational state built"],
  });

  // 2. Build health snapshot
  const health = buildAliceLiveHealthSnapshot(input?.healthInput ?? {});

  // 3. Detect anomalies
  const anomalies = detectAliceOperationalAnomalies(input?.anomalyInput ?? {});

  // 4. Apply health/state impact from anomalies
  const anomalyImpactedState = getStateImpactFromAnomalies(anomalies, currentState);
  const anomalyImpactedHealth =
    anomalies.length > 0
      ? health.health === "healthy"
        ? hasCriticalAnomalies(anomalies)
          ? "unknown"
          : "degraded"
        : health.health
      : health.health;

  // 5. Build operator control decision
  const controlAction = input?.controlAction ?? "none";
  const controlDecision = buildAliceOperatorControlDecision({
    action: controlAction,
    currentState: anomalyImpactedState,
    reason: input?.controlReason,
  });

  // 6. Apply resulting state transition
  let resultingState: AliceLiveOperationalState;
  if (controlDecision.accepted) {
    resultingState = buildAliceLiveOperationalState({
      state: controlDecision.resultingState,
      source: "operator",
      notes: [`Applied operator control: ${controlAction}`, ...(controlDecision.notes ?? [])],
    });
  } else {
    // Control not accepted — use anomaly-impacted state
    resultingState = buildAliceLiveOperationalState({
      state: anomalyImpactedState,
      source: "health",
      notes: ["Operator control rejected — using health-derived state"],
    });
  }

  // Update health with anomaly impact
  const effectiveHealth: AliceLiveHealthSnapshot = {
    ...health,
    health: anomalyImpactedHealth,
  };

  // 7. Return — never pretend healthy if degraded/held/disabled truth exists
  return {
    operationalState,
    health: effectiveHealth,
    anomalies,
    controlDecision,
    resultingState,
  };
}
