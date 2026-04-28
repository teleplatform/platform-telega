// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Incident State
//
// Builds first-class incident state.
// States: none, suspected, active, recovering, restored, failed_recovery
// Sources: operator, signals, health, fallback
// ─────────────────────────────────────────────────────────────

import type { AliceIncidentState } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildAliceIncidentState(input: {
  state: AliceIncidentState["state"];
  source: AliceIncidentState["source"];
  notes?: string[];
}): AliceIncidentState {
  return {
    state: input.state,
    source: input.source,
    updatedAt: nowIso(),
    notes: input.notes,
  };
}

export function getDefaultIncidentState(): AliceIncidentState {
  return buildAliceIncidentState({
    state: "none",
    source: "health",
    notes: ["No incident — system operating normally"],
  });
}

export function transitionIncidentState(
  currentState: AliceIncidentState,
  newState: AliceIncidentState["state"],
  source: AliceIncidentState["source"],
): AliceIncidentState {
  return buildAliceIncidentState({
    state: newState,
    source,
    notes: [
      `Transitioned from: ${currentState.state}`,
      ...(currentState.notes ?? []),
    ],
  });
}
