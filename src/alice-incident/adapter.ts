// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Main Handler
//
// prepareAliceIncidentRecoveryState() does ONLY:
// 1. resolve incident from anomalies/health/live state
// 2. classify severity
// 3. build incident state
// 4. build incident record
// 5. choose recovery playbook
// 6. build recovery decision
// 7. apply control impact if needed
// 8. build recovery outcome
// 9. decide restoration eligibility
// 10. never claim restored/live without restoration gate
// ─────────────────────────────────────────────────────────────

import type {
  AliceIncidentState,
  AliceIncidentRecord,
  AliceIncidentSeverity,
  AliceRecoveryDecision,
  AliceRecoveryOutcome,
  AliceRecoveryPlaybook,
} from "./types.js";
import type {
  AliceAnomalySignal,
  AliceLiveHealthSnapshot,
  AliceLiveOperationalState,
} from "../alice-ops/types.js";
import { buildAliceIncidentRecord } from "./incident.js";
import { resolveAliceIncidentSeverity, getSeverityDescription } from "./severity.js";
import { buildAliceIncidentState, getDefaultIncidentState, transitionIncidentState } from "./states.js";
import { resolveIncidentFromLiveSignals } from "./signals.js";
import { selectAliceRecoveryPlaybook } from "./playbooks.js";
import { buildAliceRecoveryDecision, executeAliceRecoveryDecision } from "./recovery.js";
import { buildAliceRecoveryOutcome, canRestoreAliceLive } from "./restoration.js";
import { applyIncidentControlImpact } from "./controls.js";

export type IncidentRecoveryPrepResult = {
  incidentState: AliceIncidentState;
  incidentRecord?: AliceIncidentRecord;
  severity: AliceIncidentSeverity;
  recoveryPlaybooks: AliceRecoveryPlaybook[];
  recoveryDecision: AliceRecoveryDecision;
  recoveryOutcome: AliceRecoveryOutcome;
  restorationEligible: { canRestore: boolean; reason?: string };
  resultingLiveState: AliceLiveOperationalState["state"];
};

export function prepareAliceIncidentRecoveryState(input: {
  currentLiveState: AliceLiveOperationalState["state"];
  health: AliceLiveHealthSnapshot;
  anomalySignals: AliceAnomalySignal[];
  recoveryAction?: AliceRecoveryDecision["action"];
  operatorApprovedRestore?: boolean;
}): IncidentRecoveryPrepResult {
  const currentLiveState = input.currentLiveState;
  const health = input.health;
  const anomalySignals = input.anomalySignals;

  // 1. Resolve incident from live signals
  const classification = resolveIncidentFromLiveSignals({
    anomalySignals,
    health,
    liveState: { state: currentLiveState, source: "health", updatedAt: new Date().toISOString() },
  });

  // 2. Classify severity
  const severity = resolveAliceIncidentSeverity({
    anomalySignals,
    healthImpact: health.health,
  });

  // 3. Build incident state
  let incidentState: AliceIncidentState;
  if (!classification.isIncident) {
    incidentState = getDefaultIncidentState();
  } else {
    incidentState = buildAliceIncidentState({
      state: "active",
      source: "signals",
      notes: [`Incident classified: ${classification.severity}`, `Trigger: ${classification.trigger}`],
    });
  }

  // 4. Build incident record (only if incident)
  let incidentRecord: AliceIncidentRecord | undefined;
  if (classification.isIncident) {
    incidentRecord = buildAliceIncidentRecord({
      severity: classification.severity,
      trigger: classification.trigger,
      notes: classification.notes,
    });
  }

  // 5. Choose recovery playbook
  const recoveryPlaybooks = classification.isIncident
    ? selectAliceRecoveryPlaybook(classification.trigger)
    : [];

  // 6. Build recovery decision
  const recoveryAction = input.recoveryAction ?? "none";
  const recoveryDecision = buildAliceRecoveryDecision({
    action: recoveryAction,
    incidentState: incidentState.state,
    reason: `Recovery action: ${recoveryAction}`,
  });

  // 7. Apply control impact
  const resultingLiveState = applyIncidentControlImpact({
    currentLiveState,
    incidentState: incidentState.state,
    severity: severity.severity,
  });

  // 8. Build recovery outcome
  const executionResult = recoveryDecision.accepted
    ? executeAliceRecoveryDecision(recoveryDecision, incidentState)
    : { newState: incidentState.state, outcome: "not_attempted" as const };

  // Update incident state based on execution
  if (recoveryDecision.accepted) {
    incidentState = transitionIncidentState(incidentState, executionResult.newState, "operator");
  }

  const recoveryOutcome = buildAliceRecoveryOutcome({
    recoveryAttempted: recoveryDecision.accepted,
    recoverySucceeded: executionResult.outcome !== "failed" && executionResult.outcome !== "not_attempted",
    partialRecovery: executionResult.outcome === "partially_recovered",
    targetState: resultingLiveState,
    notes: [`Recovery action: ${recoveryAction}`, `Outcome: ${executionResult.outcome}`],
  });

  // 9. Decide restoration eligibility
  const restorationEligible = canRestoreAliceLive({
    incidentState: incidentState.state,
    recoveryOutcome: recoveryOutcome.outcome,
    healthChecksPassed: health.health === "healthy",
    operatorApproved: input.operatorApprovedRestore ?? false,
  });

  // 10. Return — never claim restored/live without restoration gate
  return {
    incidentState,
    incidentRecord,
    severity,
    recoveryPlaybooks,
    recoveryDecision,
    recoveryOutcome,
    restorationEligible,
    resultingLiveState,
  };
}
