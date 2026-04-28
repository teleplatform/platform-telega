// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Selectors
//
// getAliceTrustSafetyAdapter()
// supportsRiskClassification()
// supportsTrustBoundaries()
// supportsRefusalDiscipline()
// supportsSafeMode()
// supportsSensitiveIntentHandling()
// supportsVoiceSafeShaping()
// ─────────────────────────────────────────────────────────────

import type { AliceTrustSafetyAdapter } from "./types.js";

let _adapter: AliceTrustSafetyAdapter | null = null;

export function setAliceTrustSafetyAdapter(adapter: AliceTrustSafetyAdapter): void {
  _adapter = adapter;
}

export function getAliceTrustSafetyAdapter(): AliceTrustSafetyAdapter | null {
  return _adapter;
}

export function supportsRiskClassification(): boolean | undefined {
  return _adapter?.supportsRiskClassification;
}

export function supportsTrustBoundaries(): boolean | undefined {
  return _adapter?.supportsTrustBoundaries;
}

export function supportsRefusalDiscipline(): boolean | undefined {
  return _adapter?.supportsRefusalDiscipline;
}

export function supportsSafeMode(): boolean | undefined {
  return _adapter?.supportsSafeMode;
}

export function supportsSensitiveIntentHandling(): boolean | undefined {
  return _adapter?.supportsSensitiveIntentHandling;
}

export function supportsVoiceSafeShaping(): boolean | undefined {
  return _adapter?.supportsVoiceSafeShaping;
}

export function getAdapterVersion(): string | undefined {
  return _adapter?.version;
}

export function getAdapterId(): string | undefined {
  return _adapter?.adapterId;
}
