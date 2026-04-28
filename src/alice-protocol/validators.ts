// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Validators
//
// Checks:
// - adapterId is set
// - version is set
// - supportsProtocolValidation === true
// - supportsRequestNormalization === true
// - supportsResponseMapping === true
// - supportsTruthfulEndSession === true
// ─────────────────────────────────────────────────────────────

import type { AliceProtocolAdapter, AliceProtocolValidationError, AliceProtocolRequest } from "./types.js";
import { hasExtractableText } from "./request.js";

export function validateAliceProtocolAdapter(adapter: AliceProtocolAdapter): AliceProtocolValidationError[] {
  const errors: AliceProtocolValidationError[] = [];

  if (!adapter.adapterId || adapter.adapterId.trim() === "") {
    errors.push({ path: "adapterId", message: "adapterId is required" });
  }
  if (!adapter.version || adapter.version.trim() === "") {
    errors.push({ path: "version", message: "version is required" });
  }
  if (adapter.supportsProtocolValidation !== true) {
    errors.push({ path: "supportsProtocolValidation", message: "Must be true" });
  }
  if (adapter.supportsRequestNormalization !== true) {
    errors.push({ path: "supportsRequestNormalization", message: "Must be true" });
  }
  if (adapter.supportsResponseMapping !== true) {
    errors.push({ path: "supportsResponseMapping", message: "Must be true" });
  }
  if (adapter.supportsTruthfulEndSession !== true) {
    errors.push({ path: "supportsTruthfulEndSession", message: "Must be true" });
  }

  return errors;
}

export function validateProtocolRequest(request: AliceProtocolRequest): AliceProtocolValidationError[] {
  const errors: AliceProtocolValidationError[] = [];

  if (!request.session?.session_id || request.session.session_id.trim().length === 0) {
    errors.push({ path: "session.session_id", message: "session_id is required" });
  }
  if (!request.request) {
    errors.push({ path: "request", message: "request object is required" });
  }
  if (!hasExtractableText(request)) {
    errors.push({ path: "request", message: "No extractable text (command or original_utterance required)" });
  }

  return errors;
}
