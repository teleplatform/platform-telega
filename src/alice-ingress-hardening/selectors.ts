// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Selectors
//
// getAliceIngressHardeningAdapter()
// supportsSharedSecretCheck()
// supportsReplayProtection()
// supportsFingerprinting()
// supportsRateLimitHooks()
// supportsAuditTrail()
// supportsObservability()
// supportsSafeLogging()
// ─────────────────────────────────────────────────────────────

import type { AliceIngressHardeningAdapter } from "./types.js";

let _adapter: AliceIngressHardeningAdapter | null = null;

export function setAliceIngressHardeningAdapter(adapter: AliceIngressHardeningAdapter): void {
  _adapter = adapter;
}

export function getAliceIngressHardeningAdapter(): AliceIngressHardeningAdapter | null {
  return _adapter;
}

export function supportsSharedSecretCheck(): boolean | undefined {
  return _adapter?.supportsSharedSecretCheck;
}

export function supportsReplayProtection(): boolean | undefined {
  return _adapter?.supportsReplayProtection;
}

export function supportsFingerprinting(): boolean | undefined {
  return _adapter?.supportsFingerprinting;
}

export function supportsRateLimitHooks(): boolean | undefined {
  return _adapter?.supportsRateLimitHooks;
}

export function supportsAuditTrail(): boolean | undefined {
  return _adapter?.supportsAuditTrail;
}

export function supportsObservability(): boolean | undefined {
  return _adapter?.supportsObservability;
}

export function supportsSafeLogging(): boolean | undefined {
  return _adapter?.supportsSafeLogging;
}

export function getAdapterVersion(): string | undefined {
  return _adapter?.version;
}

export function getAdapterId(): string | undefined {
  return _adapter?.adapterId;
}
