// ─────────────────────────────────────────────────────────────
// ALICE VOICE BRIDGE ADAPTER v1.0 — Validators
//
// Checks:
// - adapterId is set
// - version is set
// - supportsArishaEntryDetection === true
// - supportsSessionBinding === true
// - supportsTransportTruth === true
// - supportsFallbackToTextSurface === true
// - RU entry patterns exist
// - response outcomes truthfully classified
// ─────────────────────────────────────────────────────────────

import type { AliceVoiceBridgeAdapter, AliceBridgeValidationError, AliceBridgeResponse, EntryPattern } from "./types.js";

export function validateAliceBridgeAdapter(adapter: AliceVoiceBridgeAdapter): AliceBridgeValidationError[] {
  const errors: AliceBridgeValidationError[] = [];

  if (!adapter.adapterId || adapter.adapterId.trim() === "") {
    errors.push({ path: "adapterId", message: "adapterId is required" });
  }
  if (!adapter.version || adapter.version.trim() === "") {
    errors.push({ path: "version", message: "version is required" });
  }
  if (adapter.supportsArishaEntryDetection !== true) {
    errors.push({ path: "supportsArishaEntryDetection", message: "Must be true" });
  }
  if (adapter.supportsSessionBinding !== true) {
    errors.push({ path: "supportsSessionBinding", message: "Must be true" });
  }
  if (adapter.supportsTransportTruth !== true) {
    errors.push({ path: "supportsTransportTruth", message: "Must be true" });
  }
  if (adapter.supportsFallbackToTextSurface !== true) {
    errors.push({ path: "supportsFallbackToTextSurface", message: "Must be true" });
  }

  return errors;
}

export function validateEntryPatterns(patterns: EntryPattern[]): AliceBridgeValidationError[] {
  const errors: AliceBridgeValidationError[] = [];

  if (!patterns || patterns.length === 0) {
    errors.push({ path: "entryPatterns", message: "At least one entry pattern is required" });
  }

  // Check that RU patterns exist
  const ruPatterns = patterns.filter((p) => p.languageCode === "ru");
  if (ruPatterns.length === 0) {
    errors.push({ path: "entryPatterns.ru", message: "RU entry patterns are required" });
  }

  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    if (!p.pattern || p.pattern.trim() === "") {
      errors.push({ path: `entryPatterns[${i}].pattern`, message: "Pattern text is required" });
    }
    if (p.intent !== "arisha_entry") {
      errors.push({ path: `entryPatterns[${i}].intent`, message: "Intent must be 'arisha_entry'" });
    }
  }

  return errors;
}

export function validateAliceBridgeResponse(response: AliceBridgeResponse): AliceBridgeValidationError[] {
  const errors: AliceBridgeValidationError[] = [];

  if (!response.requestId || response.requestId.trim() === "") {
    errors.push({ path: "requestId", message: "requestId is required" });
  }

  const validOutcomes = ["opened", "forwarded", "acknowledged", "delivered", "transferred", "fallback_delivered", "blocked", "failed"] as const;
  if (!validOutcomes.includes(response.outcome)) {
    errors.push({ path: "outcome", message: `Invalid outcome: ${response.outcome}` });
  }

  // Delivered must have responseText
  if (response.outcome === "delivered" && !response.responseText) {
    errors.push({ path: "responseText", message: "Delivered outcome requires responseText" });
  }

  return errors;
}
