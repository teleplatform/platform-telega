// ─────────────────────────────────────────────────────────────
// ALICE EXTERNAL LAUNCH / GO-LIVE PACK v1.0 — Launch Outcome
//
// Builds the final launch outcome after gates + smoke + decision.
// Never pretends launch already succeeded externally.
// ─────────────────────────────────────────────────────────────

import type { AliceLaunchOutcome, AliceLaunchPlan, AliceGoLiveGateResult, AliceLaunchSmokeResult } from "./types.js";
import { isControlledLiveMode } from "./modes.js";

export function buildAliceLaunchOutcome(input: {
  plan: AliceLaunchPlan;
  gates: AliceGoLiveGateResult;
  smoke: AliceLaunchSmokeResult;
}): AliceLaunchOutcome {
  const notes: string[] = [];

  // Cannot go live without gates
  if (!input.gates.gatesPassed) {
    return {
      launchAccepted: false,
      launchState: "gated",
      reason: "Launch gates not passed",
      notes: ["Gates must pass before launch can proceed", ...(input.gates.blockers ?? [])],
    };
  }

  // Cannot go live without smoke
  if (!input.smoke.smokePassed) {
    return {
      launchAccepted: false,
      launchState: "smoke_failed",
      reason: "Smoke checks failed",
      notes: ["Smoke checks must pass before live launch", ...(input.smoke.blockers ?? [])],
    };
  }

  // Mode-specific decision
  const mode = input.plan.mode;

  if (isControlledLiveMode(mode)) {
    // Gates + smoke passed + controlled_live mode → live
    return {
      launchAccepted: true,
      launchState: "live",
      reason: "Gates and smoke passed — controlled live launch accepted",
      notes: ["Launch state: live", `Mode: ${mode}`, "Gates: passed", "Smoke: passed"],
    };
  }

  if (mode === "internal_only") {
    return {
      launchAccepted: true,
      launchState: "live",
      reason: "Internal-only launch accepted",
      notes: ["Launch state: live (internal only)", `Mode: ${mode}`, "Gates: passed", "Smoke: passed"],
    };
  }

  // dry_run mode
  return {
    launchAccepted: false,
    launchState: "not_started",
    reason: "Dry run mode — no actual launch",
    notes: ["Dry run completed successfully — gates and smoke validated but no live launch"],
  };
}

export function getLaunchStateDescription(state: AliceLaunchOutcome["launchState"]): string {
  switch (state) {
    case "not_started":
      return "Launch not initiated";
    case "gated":
      return "Launch blocked by gate failures";
    case "smoke_failed":
      return "Launch blocked by smoke check failures";
    case "live":
      return "Launch active — skill is externally available";
    case "held":
      return "Launch manually paused";
    case "rolled_back":
      return "Launch rolled back — no longer live";
    case "failed":
      return "Launch failed — critical failure";
    default:
      return `Unknown launch state: ${state}`;
  }
}
