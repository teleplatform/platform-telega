// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Recovery
//
// Recovery is explicit and bounded:
// - attempt_recovery, hold, degrade, disable, restore_live
// - Each action explicitly accepted or rejected
// - Not magic — recorded outcome with operator visibility
// ─────────────────────────────────────────────────────────────

import type { AliceRecoveryDecision, AliceIncidentState } from "./types.js";

export function buildAliceRecoveryDecision(input: {
  action: AliceRecoveryDecision["action"];
  incidentState: AliceIncidentState["state"];
  recoveryPreviouslyAttempted?: boolean;
  reason?: string;
  notes?: string[];
}): AliceRecoveryDecision {
  let accepted = true;

  // restore_live only allowed if not active and not failed_recovery
  if (input.action === "restore_live") {
    if (input.incidentState === "active" || input.incidentState === "failed_recovery") {
      accepted = false;
    }
  }

  // attempt_recovery only once (no repeated attempts without resolution)
  if (input.action === "attempt_recovery" && input.recoveryPreviouslyAttempted) {
    accepted = false;
  }

  return {
    action: input.action,
    accepted,
    reason: accepted ? input.reason : `Action '${input.action}' not accepted — incident state: ${input.incidentState}`,
    notes: input.notes,
  };
}

export function executeAliceRecoveryDecision(
  decision: AliceRecoveryDecision,
  incidentState: AliceIncidentState,
): { newState: AliceIncidentState["state"]; outcome: "recovered" | "partially_recovered" | "failed" | "not_attempted" } {
  if (!decision.accepted) {
    return { newState: incidentState.state, outcome: "not_attempted" };
  }

  switch (decision.action) {
    case "attempt_recovery":
      return { newState: "recovering", outcome: "partially_recovered" };
    case "hold":
      return { newState: "active", outcome: "not_attempted" };
    case "degrade":
      return { newState: "recovering", outcome: "partially_recovered" };
    case "disable":
      return { newState: "failed_recovery", outcome: "failed" };
    case "restore_live":
      return { newState: "restored", outcome: "recovered" };
    default:
      return { newState: incidentState.state, outcome: "not_attempted" };
  }
}
