// ─────────────────────────────────────────────────────────────
// ALICE EXTERNAL LAUNCH / GO-LIVE PACK v1.0 — Launch Modes
//
// Bounded launch modes:
// - dry_run: structure check only, no live claims
// - internal_only: controlled internal/operator use
// - controlled_live: real external go-live after gates + smoke
// ─────────────────────────────────────────────────────────────

import type { AliceLaunchPlan } from "./types.js";

export type LaunchMode = AliceLaunchPlan["mode"];

export function resolveAliceLaunchMode(input?: {
  mode?: LaunchMode;
  gatesPassed?: boolean;
  smokePassed?: boolean;
}): LaunchMode {
  const mode = input?.mode ?? "dry_run";

  // If gates or smoke failed, downgrade to dry_run
  if (input?.gatesPassed === false || input?.smokePassed === false) {
    return "dry_run";
  }

  // controlled_live requires both gates and smoke
  if (mode === "controlled_live") {
    if (input?.gatesPassed !== true || input?.smokePassed !== true) {
      return "dry_run";
    }
  }

  return mode;
}

export function isControlledLiveMode(mode: LaunchMode): boolean {
  return mode === "controlled_live";
}

export function isInternalOnlyMode(mode: LaunchMode): boolean {
  return mode === "internal_only";
}

export function isDryRunMode(mode: LaunchMode): boolean {
  return mode === "dry_run";
}

export function getModeDescription(mode: LaunchMode): string {
  switch (mode) {
    case "dry_run":
      return "Structure check only — no external live claims";
    case "internal_only":
      return "Controlled internal/operator launch — limited exposure";
    case "controlled_live":
      return "Real external go-live — gates and smoke passed";
    default:
      return `Unknown launch mode: ${mode}`;
  }
}
