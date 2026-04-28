// ─────────────────────────────────────────────────────────────
// ALICE EXTERNAL LAUNCH / GO-LIVE PACK v1.0 — Selectors
//
// getAliceGoLiveAdapter()
// supportsLaunchPlan()
// supportsGateValidation()
// supportsSmokeChecks()
// supportsControlledModes()
// supportsRollbackDiscipline()
// supportsLaunchOutcomeTracking()
// ─────────────────────────────────────────────────────────────

import type { AliceGoLiveAdapter } from "./types.js";

let _adapter: AliceGoLiveAdapter | null = null;

export function setAliceGoLiveAdapter(adapter: AliceGoLiveAdapter): void {
  _adapter = adapter;
}

export function getAliceGoLiveAdapter(): AliceGoLiveAdapter | null {
  return _adapter;
}

export function supportsLaunchPlan(): boolean | undefined {
  return _adapter?.supportsLaunchPlan;
}

export function supportsGateValidation(): boolean | undefined {
  return _adapter?.supportsGateValidation;
}

export function supportsSmokeChecks(): boolean | undefined {
  return _adapter?.supportsSmokeChecks;
}

export function supportsControlledModes(): boolean | undefined {
  return _adapter?.supportsControlledModes;
}

export function supportsRollbackDiscipline(): boolean | undefined {
  return _adapter?.supportsRollbackDiscipline;
}

export function supportsLaunchOutcomeTracking(): boolean | undefined {
  return _adapter?.supportsLaunchOutcomeTracking;
}

export function getAdapterVersion(): string | undefined {
  return _adapter?.version;
}

export function getAdapterId(): string | undefined {
  return _adapter?.adapterId;
}
