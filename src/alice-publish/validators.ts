// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Validators
//
// Checks:
// - adapterId is set
// - version is set
// - All supports* flags must be true
// ─────────────────────────────────────────────────────────────

import type { AliceSkillRegistrationAdapter, AlicePublishValidationError } from "./types.js";

export function validateAlicePublishAdapter(
  adapter: AliceSkillRegistrationAdapter,
): AlicePublishValidationError[] {
  const errors: AlicePublishValidationError[] = [];

  if (!adapter.adapterId || adapter.adapterId.trim() === "") {
    errors.push({ path: "adapterId", message: "adapterId is required" });
  }
  if (!adapter.version || adapter.version.trim() === "") {
    errors.push({ path: "version", message: "version is required" });
  }
  if (adapter.supportsManifestGeneration !== true) {
    errors.push({ path: "supportsManifestGeneration", message: "Must be true" });
  }
  if (adapter.supportsInvocationProfile !== true) {
    errors.push({ path: "supportsInvocationProfile", message: "Must be true" });
  }
  if (adapter.supportsEnvironmentReadiness !== true) {
    errors.push({ path: "supportsEnvironmentReadiness", message: "Must be true" });
  }
  if (adapter.supportsPublishValidation !== true) {
    errors.push({ path: "supportsPublishValidation", message: "Must be true" });
  }
  if (adapter.supportsChecklistGeneration !== true) {
    errors.push({ path: "supportsChecklistGeneration", message: "Must be true" });
  }

  return errors;
}
