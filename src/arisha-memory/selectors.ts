// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Selectors
//
// getArishaMemoryTrustAdapter()
// supportsMemoryBoundary()
// supportsMemoryUsageDecisions()
// supportsPersonalizationProfiles()
// supportsToneAdaptation()
// supportsContinuityDecisions()
// supportsDormantMemoryHandling()
// ─────────────────────────────────────────────────────────────

import type { ArishaMemoryTrustAdapter } from "./types.js";

let _adapter: ArishaMemoryTrustAdapter | null = null;

export function setArishaMemoryTrustAdapter(adapter: ArishaMemoryTrustAdapter): void {
  _adapter = adapter;
}

export function getArishaMemoryTrustAdapter(): ArishaMemoryTrustAdapter | null {
  return _adapter;
}

export function supportsMemoryBoundary(): boolean | undefined {
  return _adapter?.supportsMemoryBoundary;
}

export function supportsMemoryUsageDecisions(): boolean | undefined {
  return _adapter?.supportsMemoryUsageDecisions;
}

export function supportsPersonalizationProfiles(): boolean | undefined {
  return _adapter?.supportsPersonalizationProfiles;
}

export function supportsToneAdaptation(): boolean | undefined {
  return _adapter?.supportsToneAdaptation;
}

export function supportsContinuityDecisions(): boolean | undefined {
  return _adapter?.supportsContinuityDecisions;
}

export function supportsDormantMemoryHandling(): boolean | undefined {
  return _adapter?.supportsDormantMemoryHandling;
}

export function getAdapterVersion(): string | undefined {
  return _adapter?.version;
}

export function getAdapterId(): string | undefined {
  return _adapter?.adapterId;
}
