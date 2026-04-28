// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Validators
//
// Checks:
// - adapterId is set
// - version is set
// - All supports* flags must be true
// ─────────────────────────────────────────────────────────────

import type { ArishaMemoryTrustAdapter, ArishaMemoryValidationError } from "./types.js";

export function validateArishaMemoryTrustAdapter(
  adapter: ArishaMemoryTrustAdapter,
): ArishaMemoryValidationError[] {
  const errors: ArishaMemoryValidationError[] = [];

  if (!adapter.adapterId || adapter.adapterId.trim() === "") {
    errors.push({ path: "adapterId", message: "adapterId is required" });
  }
  if (!adapter.version || adapter.version.trim() === "") {
    errors.push({ path: "version", message: "version is required" });
  }
  if (adapter.supportsMemoryBoundary !== true) {
    errors.push({ path: "supportsMemoryBoundary", message: "Must be true" });
  }
  if (adapter.supportsMemoryUsageDecisions !== true) {
    errors.push({ path: "supportsMemoryUsageDecisions", message: "Must be true" });
  }
  if (adapter.supportsPersonalizationProfiles !== true) {
    errors.push({ path: "supportsPersonalizationProfiles", message: "Must be true" });
  }
  if (adapter.supportsToneAdaptation !== true) {
    errors.push({ path: "supportsToneAdaptation", message: "Must be true" });
  }
  if (adapter.supportsContinuityDecisions !== true) {
    errors.push({ path: "supportsContinuityDecisions", message: "Must be true" });
  }
  if (adapter.supportsDormantMemoryHandling !== true) {
    errors.push({ path: "supportsDormantMemoryHandling", message: "Must be true" });
  }

  return errors;
}
