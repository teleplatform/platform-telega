// ─────────────────────────────────────────────────────────────
// ALICE WEBHOOK / HTTP ENTRY ADAPTER v1.0 — Validators
//
// Checks:
// - adapterId is set
// - version is set
// - supportsPostOnly === true
// - supportsJsonOnly === true
// - supportsBoundaryValidation === true
// - supportsBasicVerificationGate === true
// - supportsProtocolHandOff === true
// ─────────────────────────────────────────────────────────────

import type { AliceHttpEntryAdapter, AliceHttpValidationError } from "./types.js";

export function validateAliceHttpEntryAdapter(adapter: AliceHttpEntryAdapter): AliceHttpValidationError[] {
  const errors: AliceHttpValidationError[] = [];

  if (!adapter.adapterId || adapter.adapterId.trim() === "") {
    errors.push({ path: "adapterId", message: "adapterId is required" });
  }
  if (!adapter.version || adapter.version.trim() === "") {
    errors.push({ path: "version", message: "version is required" });
  }
  if (adapter.supportsPostOnly !== true) {
    errors.push({ path: "supportsPostOnly", message: "Must be true" });
  }
  if (adapter.supportsJsonOnly !== true) {
    errors.push({ path: "supportsJsonOnly", message: "Must be true" });
  }
  if (adapter.supportsBoundaryValidation !== true) {
    errors.push({ path: "supportsBoundaryValidation", message: "Must be true" });
  }
  if (adapter.supportsBasicVerificationGate !== true) {
    errors.push({ path: "supportsBasicVerificationGate", message: "Must be true" });
  }
  if (adapter.supportsProtocolHandOff !== true) {
    errors.push({ path: "supportsProtocolHandOff", message: "Must be true" });
  }

  return errors;
}
