// ─────────────────────────────────────────────────────────────
// ALICE WEBHOOK / HTTP ENTRY ADAPTER v1.0 — Boundary Validation
//
// Validates:
// - method = POST only
// - content-type = application/json only
// - body exists and is object
// - minimal session presence
// - safe request shape
//
// No raw request reaches protocol adapter without passing validation.
// ─────────────────────────────────────────────────────────────

import type { AliceHttpRequestEnvelope, AliceHttpValidationResult } from "./types.js";
import { isMethodPost, isContentTypeJson, hasRequestBody } from "./request.js";

export function validateAliceHttpRequest(envelope: AliceHttpRequestEnvelope): AliceHttpValidationResult {
  const errors: string[] = [];
  let httpStatus: number = 400;

  // Method check (highest priority)
  if (!isMethodPost(envelope)) {
    errors.push("Only POST method is accepted");
    httpStatus = 405; // Most specific error takes priority
  }

  // Content-type check
  if (!isContentTypeJson(envelope)) {
    errors.push("Only application/json content-type is accepted");
    if (httpStatus === 400) httpStatus = 415; // Only override if not already more specific
  }

  // Body presence check
  if (!hasRequestBody(envelope)) {
    errors.push("Request body is required");
  }

  // Body shape check
  if (envelope.body && typeof envelope.body !== "object") {
    errors.push("Request body must be a JSON object");
  }

  // Minimal session check
  if (envelope.body && !envelope.body.session) {
    errors.push("session object is required in request body");
  }

  // Session ID check
  if (envelope.body?.session && typeof envelope.body.session !== "object") {
    errors.push("session must be an object");
  }

  if (envelope.body?.session && !(envelope.body.session as Record<string, unknown>).session_id) {
    errors.push("session.session_id is required");
  }

  return {
    valid: errors.length === 0,
    errors,
    httpStatus,
  };
}

export function isPostRequest(envelope: AliceHttpRequestEnvelope): boolean {
  return isMethodPost(envelope);
}

export function isJsonRequest(envelope: AliceHttpRequestEnvelope): boolean {
  return isContentTypeJson(envelope);
}
