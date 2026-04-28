// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Validators
//
// Checks:
// - adapterId is set
// - version is set
// - All supports* flags must be true
// ─────────────────────────────────────────────────────────────

import type { AliceLiveOpsAdapter, AliceOpsValidationError } from "./types.js";

export function validateAliceLiveOpsAdapter(
  adapter: AliceLiveOpsAdapter,
): AliceOpsValidationError[] {
  const errors: AliceOpsValidationError[] = [];

  if (!adapter.adapterId || adapter.adapterId.trim() === "") {
    errors.push({ path: "adapterId", message: "adapterId is required" });
  }
  if (!adapter.version || adapter.version.trim() === "") {
    errors.push({ path: "version", message: "version is required" });
  }
  if (adapter.supportsOperationalState !== true) {
    errors.push({ path: "supportsOperationalState", message: "Must be true" });
  }
  if (adapter.supportsLiveHealthSnapshot !== true) {
    errors.push({ path: "supportsLiveHealthSnapshot", message: "Must be true" });
  }
  if (adapter.supportsOperatorControls !== true) {
    errors.push({ path: "supportsOperatorControls", message: "Must be true" });
  }
  if (adapter.supportsDegradeMode !== true) {
    errors.push({ path: "supportsDegradeMode", message: "Must be true" });
  }
  if (adapter.supportsDisableMode !== true) {
    errors.push({ path: "supportsDisableMode", message: "Must be true" });
  }
  if (adapter.supportsAnomalySignals !== true) {
    errors.push({ path: "supportsAnomalySignals", message: "Must be true" });
  }

  return errors;
}
