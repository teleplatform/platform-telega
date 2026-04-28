// ─────────────────────────────────────────────────────────────
// ALICE EXTERNAL LAUNCH / GO-LIVE PACK v1.0 — Validators
//
// Checks:
// - adapterId is set
// - version is set
// - All supports* flags must be true
// ─────────────────────────────────────────────────────────────

import type { AliceGoLiveAdapter, AliceLaunchValidationError } from "./types.js";

export function validateAliceGoLiveAdapter(
  adapter: AliceGoLiveAdapter,
): AliceLaunchValidationError[] {
  const errors: AliceLaunchValidationError[] = [];

  if (!adapter.adapterId || adapter.adapterId.trim() === "") {
    errors.push({ path: "adapterId", message: "adapterId is required" });
  }
  if (!adapter.version || adapter.version.trim() === "") {
    errors.push({ path: "version", message: "version is required" });
  }
  if (adapter.supportsLaunchPlan !== true) {
    errors.push({ path: "supportsLaunchPlan", message: "Must be true" });
  }
  if (adapter.supportsGateValidation !== true) {
    errors.push({ path: "supportsGateValidation", message: "Must be true" });
  }
  if (adapter.supportsSmokeChecks !== true) {
    errors.push({ path: "supportsSmokeChecks", message: "Must be true" });
  }
  if (adapter.supportsControlledModes !== true) {
    errors.push({ path: "supportsControlledModes", message: "Must be true" });
  }
  if (adapter.supportsRollbackDiscipline !== true) {
    errors.push({ path: "supportsRollbackDiscipline", message: "Must be true" });
  }
  if (adapter.supportsLaunchOutcomeTracking !== true) {
    errors.push({ path: "supportsLaunchOutcomeTracking", message: "Must be true" });
  }

  return errors;
}
