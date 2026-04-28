// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Control Impact
//
// Applies incident control impact to live operational state.
// Incident may force live degraded/held/disabled state.
// Live degraded state ≠ formal incident, but incident may force it.
// ─────────────────────────────────────────────────────────────

import type { AliceIncidentState, AliceIncidentSeverity } from "./types.js";
import type { AliceLiveOperationalState } from "../alice-ops/types.js";

export function applyIncidentControlImpact(input: {
  currentLiveState: AliceLiveOperationalState["state"];
  incidentState: AliceIncidentState["state"];
  severity: AliceIncidentSeverity["severity"];
}): AliceLiveOperationalState["state"] {
  // If incident is active, apply impact based on severity
  if (input.incidentState === "active") {
    switch (input.severity) {
      case "critical":
        return "disabled";
      case "high":
        return "degraded";
      case "medium":
        return input.currentLiveState === "live" ? "degraded" : input.currentLiveState;
      default:
        return input.currentLiveState;
    }
  }

  // If recovering, keep current state (don't auto-restore)
  if (input.incidentState === "recovering") {
    return input.currentLiveState;
  }

  // If restored, can return to live
  if (input.incidentState === "restored") {
    return "live";
  }

  // No incident impact
  return input.currentLiveState;
}
