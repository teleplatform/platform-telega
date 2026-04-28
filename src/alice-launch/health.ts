// ─────────────────────────────────────────────────────────────
// ALICE EXTERNAL LAUNCH / GO-LIVE PACK v1.0 — Health Snapshot
//
// Bounded post-launch health layer:
// - healthy, degraded, unknown
//
// No full monitoring platform — just launch-state visibility.
// ─────────────────────────────────────────────────────────────

import type { AliceLaunchHealthSnapshot, AliceLaunchOutcome } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildAliceLaunchHealthSnapshot(input: {
  launchState: AliceLaunchOutcome["launchState"];
  gatesPassed?: boolean;
  smokePassed?: boolean;
}): AliceLaunchHealthSnapshot {
  // Determine health state
  let state: "healthy" | "degraded" | "unknown" = "unknown";

  if (input.launchState === "live") {
    state = input.gatesPassed && input.smokePassed ? "healthy" : "degraded";
  } else if (input.launchState === "held" || input.launchState === "rolled_back") {
    state = "degraded";
  } else if (input.launchState === "failed" || input.launchState === "smoke_failed" || input.launchState === "gated") {
    state = "unknown";
  } else {
    state = "unknown";
  }

  const checksPassed = (input.gatesPassed ? 1 : 0) + (input.smokePassed ? 1 : 0);
  const checksFailed = (input.gatesPassed ? 0 : 1) + (input.smokePassed ? 0 : 1);

  return {
    state,
    launchState: input.launchState,
    checksPassed,
    checksFailed,
    timestamp: nowIso(),
  };
}

export function getHealthDescription(state: AliceLaunchHealthSnapshot["state"]): string {
  switch (state) {
    case "healthy":
      return "All checks passed — launch operating normally";
    case "degraded":
      return "Some checks failing or launch paused/rolled back";
    case "unknown":
      return "Health status indeterminate — investigation needed";
    default:
      return `Unknown health state: ${state}`;
  }
}
