// ─────────────────────────────────────────────────────────────
// ALICE WEBHOOK / HTTP ENTRY ADAPTER v1.0 — Error Builders
//
// Safe, non-leaky HTTP error responses.
// No stack traces, no internal runtime details.
// ─────────────────────────────────────────────────────────────

import type { AliceHttpResponseEnvelope } from "./types.js";
import { buildJsonErrorResponse } from "./response.js";

export function buildInvalidMethodResponse(method?: string): AliceHttpResponseEnvelope {
  return buildJsonErrorResponse(405, `Method not allowed: ${method ?? "unknown"}. Only POST is accepted.`);
}

export function buildInvalidContentTypeResponse(ct?: string): AliceHttpResponseEnvelope {
  return buildJsonErrorResponse(415, `Unsupported content type: ${ct ?? "unknown"}. Only application/json is accepted.`);
}

export function buildUnauthorizedResponse(): AliceHttpResponseEnvelope {
  return buildJsonErrorResponse(401, "Authorization required");
}

export function buildForbiddenResponse(): AliceHttpResponseEnvelope {
  return buildJsonErrorResponse(403, "Access denied");
}

export function buildInternalAdapterErrorResponse(originalError?: Error): AliceHttpResponseEnvelope {
  // Never leak stack traces or internal details
  return buildJsonErrorResponse(500, "Internal adapter error", {
    // Safe: only indicate that an error occurred, no internals
    code: "INTERNAL_ADAPTER_ERROR",
  });
}

export function buildBadRequestResponse(message: string): AliceHttpResponseEnvelope {
  return buildJsonErrorResponse(400, message);
}
