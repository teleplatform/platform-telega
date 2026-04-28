// ─────────────────────────────────────────────────────────────
// ALICE WEBHOOK / HTTP ENTRY ADAPTER v1.0 — Response Builders
//
// Builds JSON-safe HTTP response envelopes.
// Always application/json, never HTML/plain.
// Never leaks stack traces or internal runtime details.
// ─────────────────────────────────────────────────────────────

import type { AliceHttpResponseEnvelope } from "./types.js";

export function buildJsonOkResponse(
  body: Record<string, unknown>,
): AliceHttpResponseEnvelope {
  return {
    statusCode: 200,
    contentType: "application/json",
    body,
  };
}

export function buildJsonErrorResponse(
  statusCode: number,
  message: string,
  details?: Record<string, unknown>,
): AliceHttpResponseEnvelope {
  const body: Record<string, unknown> = {
    error: true,
    message,
  };
  if (details) {
    body.details = details;
  }
  return {
    statusCode,
    contentType: "application/json",
    body,
  };
}

export function buildSafeJsonResponse(
  statusCode: number,
  safeMessage: string,
): AliceHttpResponseEnvelope {
  return buildJsonErrorResponse(statusCode, safeMessage);
}
