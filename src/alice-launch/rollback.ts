// ─────────────────────────────────────────────────────────────
// ALICE EXTERNAL LAUNCH / GO-LIVE PACK v1.0 — Rollback / Hold
//
// Truthful bounded rollback path:
// - translate launch state to rolled_back
// - disable live-mode flag
// - truthfully hold/rollback outcome
// - never pretend system is still live
// ─────────────────────────────────────────────────────────────

import type { AliceRollbackDecision, AliceLaunchOutcome } from "./types.js";

export function buildAliceRollbackDecision(input: {
  launchState: AliceLaunchOutcome["launchState"];
  reason?: string;
  notes?: string[];
}): AliceRollbackDecision {
  let shouldRollback = false;
  let targetState: "held" | "rolled_back" | "failed" = "held";

  if (input.launchState === "failed" || input.launchState === "smoke_failed") {
    shouldRollback = true;
    targetState = "rolled_back";
  } else if (input.launchState === "gated") {
    shouldRollback = false;
    targetState = "held";
  } else {
    // Manual hold/rollback
    shouldRollback = input.reason !== undefined;
    targetState = shouldRollback ? "rolled_back" : "held";
  }

  return {
    shouldRollback,
    reason: input.reason,
    targetState,
    notes: input.notes,
  };
}

export function applyAliceLaunchHold(input: {
  currentLaunchState: AliceLaunchOutcome["launchState"];
  reason?: string;
}): AliceLaunchOutcome {
  return {
    launchAccepted: false,
    launchState: "held",
    reason: input.reason ?? "Launch manually held",
    notes: [`Previous state: ${input.currentLaunchState}`, ...(input.reason ? [`Hold reason: ${input.reason}`] : [])],
  };
}

export function applyAliceRollback(input: {
  currentLaunchState: AliceLaunchOutcome["launchState"];
  reason?: string;
}): AliceLaunchOutcome {
  return {
    launchAccepted: false,
    launchState: "rolled_back",
    reason: input.reason ?? "Launch rolled back",
    notes: [`Previous state: ${input.currentLaunchState}`, ...(input.reason ? [`Rollback reason: ${input.reason}`] : [])],
  };
}
