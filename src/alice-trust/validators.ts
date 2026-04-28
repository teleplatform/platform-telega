// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Validators
//
// Checks:
// - adapterId is set
// - version is set
// - All supports* flags must be true
// ─────────────────────────────────────────────────────────────

import type { AliceTrustSafetyAdapter, AliceTrustValidationError } from "./types.js";

export function validateAliceTrustSafetyAdapter(
  adapter: AliceTrustSafetyAdapter,
): AliceTrustValidationError[] {
  const errors: AliceTrustValidationError[] = [];

  if (!adapter.adapterId || adapter.adapterId.trim() === "") {
    errors.push({ path: "adapterId", message: "adapterId is required" });
  }
  if (!adapter.version || adapter.version.trim() === "") {
    errors.push({ path: "version", message: "version is required" });
  }
  if (adapter.supportsRiskClassification !== true) {
    errors.push({ path: "supportsRiskClassification", message: "Must be true" });
  }
  if (adapter.supportsTrustBoundaries !== true) {
    errors.push({ path: "supportsTrustBoundaries", message: "Must be true" });
  }
  if (adapter.supportsRefusalDiscipline !== true) {
    errors.push({ path: "supportsRefusalDiscipline", message: "Must be true" });
  }
  if (adapter.supportsSafeMode !== true) {
    errors.push({ path: "supportsSafeMode", message: "Must be true" });
  }
  if (adapter.supportsSensitiveIntentHandling !== true) {
    errors.push({ path: "supportsSensitiveIntentHandling", message: "Must be true" });
  }
  if (adapter.supportsVoiceSafeShaping !== true) {
    errors.push({ path: "supportsVoiceSafeShaping", message: "Must be true" });
  }

  return errors;
}
