// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Hold / Resume
//
// Hold means: live surface temporarily paused.
// - Not considered healthy live
// - Not considered disabled
// - Operator intentionally paused external behavior
//
// Resume means: return to live from held/degraded.
// Only accepted if current state is held or degraded,
// and health doesn't indicate critical blocker.
// ─────────────────────────────────────────────────────────────

import type { AliceLiveOperationalState } from "./types.js";
import { buildAliceLiveOperationalState } from "./state.js";

export function applyAliceHoldMode(input: {
  currentState: AliceLiveOperationalState["state"];
  reason?: string;
  notes?: string[];
}): AliceLiveOperationalState {
  return buildAliceLiveOperationalState({
    state: "held",
    source: "operator",
    notes: [
      `Transitioned from: ${input.currentState}`,
      ...(input.reason ? [`Hold reason: ${input.reason}`] : []),
      ...(input.notes ?? []),
    ],
  });
}

export function applyAliceResumeMode(input: {
  currentState: AliceLiveOperationalState["state"];
  healthCritical: boolean;
  reason?: string;
  notes?: string[];
}): { success: boolean; state?: AliceLiveOperationalState; reason?: string } {
  // Resume not allowed if critical health issues
  if (input.healthCritical) {
    return {
      success: false,
      reason: "Cannot resume — critical health issues detected",
    };
  }

  // Resume only from held or degraded
  if (input.currentState !== "held" && input.currentState !== "degraded") {
    return {
      success: false,
      reason: `Cannot resume from state: ${input.currentState} — only held/degraded allowed`,
    };
  }

  return {
    success: true,
    state: buildAliceLiveOperationalState({
      state: "live",
      source: "operator",
      notes: [
        `Resumed from: ${input.currentState}`,
        ...(input.reason ? [`Resume reason: ${input.reason}`] : []),
        ...(input.notes ?? []),
      ],
    }),
  };
}
