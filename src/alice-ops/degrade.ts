// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Degrade Mode
//
// Degrade means: system still available but in limited safe mode.
// May use safe fallback / bounded responses.
// Health: degraded (NOT healthy).
// State: degraded (NOT live).
// ─────────────────────────────────────────────────────────────

import type { AliceLiveOperationalState } from "./types.js";
import { buildAliceLiveOperationalState } from "./state.js";

export function applyAliceDegradeMode(input: {
  currentState: AliceLiveOperationalState["state"];
  reason?: string;
  notes?: string[];
}): AliceLiveOperationalState {
  return buildAliceLiveOperationalState({
    state: "degraded",
    source: "operator",
    notes: [
      `Transitioned from: ${input.currentState}`,
      ...(input.reason ? [`Reason: ${input.reason}`] : []),
      ...(input.notes ?? []),
    ],
  });
}
