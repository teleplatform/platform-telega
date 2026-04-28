// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Disable Mode
//
// Disable means: live surface intentionally stopped.
// System must NOT pretend to be live.
// Operator decision must be explicit.
// ─────────────────────────────────────────────────────────────

import type { AliceLiveOperationalState } from "./types.js";
import { buildAliceLiveOperationalState } from "./state.js";

export function applyAliceDisableMode(input: {
  currentState: AliceLiveOperationalState["state"];
  reason?: string;
  notes?: string[];
}): AliceLiveOperationalState {
  return buildAliceLiveOperationalState({
    state: "disabled",
    source: "operator",
    notes: [
      `Transitioned from: ${input.currentState}`,
      ...(input.reason ? [`Reason: ${input.reason}`] : []),
      ...(input.notes ?? []),
    ],
  });
}
