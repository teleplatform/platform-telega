// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Selectors
//
// getAliceLiveOpsAdapter()
// supportsOperationalState()
// supportsLiveHealthSnapshot()
// supportsOperatorControls()
// supportsDegradeMode()
// supportsDisableMode()
// supportsAnomalySignals()
// ─────────────────────────────────────────────────────────────

import type { AliceLiveOpsAdapter } from "./types.js";

let _adapter: AliceLiveOpsAdapter | null = null;

export function setAliceLiveOpsAdapter(adapter: AliceLiveOpsAdapter): void {
  _adapter = adapter;
}

export function getAliceLiveOpsAdapter(): AliceLiveOpsAdapter | null {
  return _adapter;
}

export function supportsOperationalState(): boolean | undefined {
  return _adapter?.supportsOperationalState;
}

export function supportsLiveHealthSnapshot(): boolean | undefined {
  return _adapter?.supportsLiveHealthSnapshot;
}

export function supportsOperatorControls(): boolean | undefined {
  return _adapter?.supportsOperatorControls;
}

export function supportsDegradeMode(): boolean | undefined {
  return _adapter?.supportsDegradeMode;
}

export function supportsDisableMode(): boolean | undefined {
  return _adapter?.supportsDisableMode;
}

export function supportsAnomalySignals(): boolean | undefined {
  return _adapter?.supportsAnomalySignals;
}

export function getAdapterVersion(): string | undefined {
  return _adapter?.version;
}

export function getAdapterId(): string | undefined {
  return _adapter?.adapterId;
}
