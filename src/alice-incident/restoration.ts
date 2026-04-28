// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Restoration
//
// Restoration gate: restore_live only if:
// - incident state not active
// - recovery outcome not failed
// - bounded checks green
// - operator explicitly accepts
//
// Partial recovery ≠ restored live.
// ─────────────────────────────────────────────────────────────

import type { AliceRecoveryOutcome, AliceIncidentState } from "./types.js";

export function buildAliceRecoveryOutcome(input: {
  recoveryAttempted: boolean;
  recoverySucceeded: boolean;
  partialRecovery: boolean;
  targetState: "live" | "degraded" | "held" | "disabled" | "unknown";
  notes?: string[];
}): AliceRecoveryOutcome {
  let outcome: AliceRecoveryOutcome["outcome"];

  if (!input.recoveryAttempted) {
    outcome = "not_attempted";
  } else if (input.recoverySucceeded && !input.partialRecovery) {
    outcome = "recovered";
  } else if (input.recoverySucceeded && input.partialRecovery) {
    outcome = "partially_recovered";
  } else {
    outcome = "failed";
  }

  return {
    outcome,
    restoredState: input.targetState,
    notes: input.notes,
  };
}

export function canRestoreAliceLive(input: {
  incidentState: AliceIncidentState["state"];
  recoveryOutcome: AliceRecoveryOutcome["outcome"];
  healthChecksPassed: boolean;
  operatorApproved: boolean;
}): { canRestore: boolean; reason?: string } {
  // Cannot restore if incident still active
  if (input.incidentState === "active") {
    return { canRestore: false, reason: "Cannot restore — incident still active" };
  }

  // Cannot restore if recovery failed
  if (input.recoveryOutcome === "failed") {
    return { canRestore: false, reason: "Cannot restore — recovery previously failed" };
  }

  // Cannot restore if health checks not passed
  if (!input.healthChecksPassed) {
    return { canRestore: false, reason: "Cannot restore — health checks not passed" };
  }

  // Cannot restore without operator approval
  if (!input.operatorApproved) {
    return { canRestore: false, reason: "Cannot restore — operator approval required" };
  }

  return { canRestore: true };
}
