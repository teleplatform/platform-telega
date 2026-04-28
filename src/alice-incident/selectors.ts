// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Selectors
//
// getAliceIncidentRecoveryAdapter()
// supportsIncidentState()
// supportsSeverityResolution()
// supportsRecoveryPlaybooks()
// supportsRecoveryDecisions()
// supportsRecoveryOutcome()
// supportsSafeRestoration()
// ─────────────────────────────────────────────────────────────

import type { AliceIncidentRecoveryAdapter } from "./types.js";

let _adapter: AliceIncidentRecoveryAdapter | null = null;

export function setAliceIncidentRecoveryAdapter(adapter: AliceIncidentRecoveryAdapter): void {
  _adapter = adapter;
}

export function getAliceIncidentRecoveryAdapter(): AliceIncidentRecoveryAdapter | null {
  return _adapter;
}

export function supportsIncidentState(): boolean | undefined {
  return _adapter?.supportsIncidentState;
}

export function supportsSeverityResolution(): boolean | undefined {
  return _adapter?.supportsSeverityResolution;
}

export function supportsRecoveryPlaybooks(): boolean | undefined {
  return _adapter?.supportsRecoveryPlaybooks;
}

export function supportsRecoveryDecisions(): boolean | undefined {
  return _adapter?.supportsRecoveryDecisions;
}

export function supportsRecoveryOutcome(): boolean | undefined {
  return _adapter?.supportsRecoveryOutcome;
}

export function supportsSafeRestoration(): boolean | undefined {
  return _adapter?.supportsSafeRestoration;
}

export function getAdapterVersion(): string | undefined {
  return _adapter?.version;
}

export function getAdapterId(): string | undefined {
  return _adapter?.adapterId;
}
