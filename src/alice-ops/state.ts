// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — State
//
// Builds first-class live operational state.
// States: live, degraded, held, disabled, unknown
// Sources: operator, health, launch, fallback
// ─────────────────────────────────────────────────────────────

import type { AliceLiveOperationalState } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildAliceLiveOperationalState(input: {
  state: AliceLiveOperationalState["state"];
  source: AliceLiveOperationalState["source"];
  notes?: string[];
}): AliceLiveOperationalState {
  return {
    state: input.state,
    source: input.source,
    updatedAt: nowIso(),
    notes: input.notes,
  };
}

export function getDefaultLiveState(): AliceLiveOperationalState {
  return buildAliceLiveOperationalState({
    state: "unknown",
    source: "launch",
    notes: ["Initial state — awaiting health check"],
  });
}
