// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Controls
//
// Bounded operator control actions:
// - none, hold, degrade, disable, resume
//
// Each action maps to a resulting state and is explicitly accepted or rejected.
// ─────────────────────────────────────────────────────────────

import type { AliceOperatorControlDecision, AliceLiveOperationalState } from "./types.js";

export function buildAliceOperatorControlDecision(input: {
  action: AliceOperatorControlDecision["action"];
  currentState: AliceLiveOperationalState["state"];
  reason?: string;
  notes?: string[];
}): AliceOperatorControlDecision {
  let accepted = true;
  let resultingState: AliceOperatorControlDecision["resultingState"] = "unknown";

  switch (input.action) {
    case "none":
      resultingState = input.currentState === "unknown" ? "unknown" : input.currentState;
      break;

    case "hold":
      resultingState = "held";
      break;

    case "degrade":
      resultingState = "degraded";
      break;

    case "disable":
      resultingState = "disabled";
      break;

    case "resume":
      // Resume only accepted if current state is held or degraded
      if (input.currentState === "held" || input.currentState === "degraded") {
        resultingState = "live";
      } else {
        accepted = false;
        resultingState = input.currentState;
      }
      break;

    default:
      accepted = false;
      resultingState = input.currentState;
  }

  return {
    action: input.action,
    accepted,
    resultingState,
    reason: input.reason,
    notes: input.notes,
  };
}

export function getControlActionDescription(action: AliceOperatorControlDecision["action"]): string {
  switch (action) {
    case "none":
      return "No operator action taken — system continues current state";
    case "hold":
      return "Live surface temporarily held — operator intentionally paused external behavior";
    case "degrade":
      return "System operating in degraded safe mode — limited functionality available";
    case "disable":
      return "Live surface intentionally disabled — system not accepting external traffic";
    case "resume":
      return "System resuming normal live operations from held/degraded state";
    default:
      return `Unknown action: ${action}`;
  }
}
