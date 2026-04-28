// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Validators
//
// Checks:
// - adapterId is set
// - version is set
// - All supports* flags must be true
// ─────────────────────────────────────────────────────────────

import type { AliceIngressHardeningAdapter, AliceIngressValidationError } from "./types.js";

export function validateIngressHardeningAdapter(
  adapter: AliceIngressHardeningAdapter,
): AliceIngressValidationError[] {
  const errors: AliceIngressValidationError[] = [];

  if (!adapter.adapterId || adapter.adapterId.trim() === "") {
    errors.push({ path: "adapterId", message: "adapterId is required" });
  }
  if (!adapter.version || adapter.version.trim() === "") {
    errors.push({ path: "version", message: "version is required" });
  }
  if (adapter.supportsSharedSecretCheck !== true) {
    errors.push({ path: "supportsSharedSecretCheck", message: "Must be true" });
  }
  if (adapter.supportsReplayProtection !== true) {
    errors.push({ path: "supportsReplayProtection", message: "Must be true" });
  }
  if (adapter.supportsFingerprinting !== true) {
    errors.push({ path: "supportsFingerprinting", message: "Must be true" });
  }
  if (adapter.supportsRateLimitHooks !== true) {
    errors.push({ path: "supportsRateLimitHooks", message: "Must be true" });
  }
  if (adapter.supportsAuditTrail !== true) {
    errors.push({ path: "supportsAuditTrail", message: "Must be true" });
  }
  if (adapter.supportsObservability !== true) {
    errors.push({ path: "supportsObservability", message: "Must be true" });
  }
  if (adapter.supportsSafeLogging !== true) {
    errors.push({ path: "supportsSafeLogging", message: "Must be true" });
  }

  return errors;
}
