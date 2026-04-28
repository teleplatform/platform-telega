// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Validators
//
// Checks:
// - adapterId is set
// - version is set
// - All supports* flags must be true
// ─────────────────────────────────────────────────────────────

import type { AliceIncidentRecoveryAdapter, AliceIncidentValidationError } from "./types.js";

export function validateAliceIncidentRecoveryAdapter(
  adapter: AliceIncidentRecoveryAdapter,
): AliceIncidentValidationError[] {
  const errors: AliceIncidentValidationError[] = [];

  if (!adapter.adapterId || adapter.adapterId.trim() === "") {
    errors.push({ path: "adapterId", message: "adapterId is required" });
  }
  if (!adapter.version || adapter.version.trim() === "") {
    errors.push({ path: "version", message: "version is required" });
  }
  if (adapter.supportsIncidentState !== true) {
    errors.push({ path: "supportsIncidentState", message: "Must be true" });
  }
  if (adapter.supportsSeverityResolution !== true) {
    errors.push({ path: "supportsSeverityResolution", message: "Must be true" });
  }
  if (adapter.supportsRecoveryPlaybooks !== true) {
    errors.push({ path: "supportsRecoveryPlaybooks", message: "Must be true" });
  }
  if (adapter.supportsRecoveryDecisions !== true) {
    errors.push({ path: "supportsRecoveryDecisions", message: "Must be true" });
  }
  if (adapter.supportsRecoveryOutcome !== true) {
    errors.push({ path: "supportsRecoveryOutcome", message: "Must be true" });
  }
  if (adapter.supportsSafeRestoration !== true) {
    errors.push({ path: "supportsSafeRestoration", message: "Must be true" });
  }

  return errors;
}
