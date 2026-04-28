// ─────────────────────────────────────────────────────────────
// ALICE WEBHOOK / HTTP ENTRY ADAPTER v1.0 — Main HTTP Handler
//
// handleAliceHttpEntry() does ONLY:
// 1. validate method
// 2. validate content-type
// 3. validate body presence/shape
// 4. run verification gate
// 5. extract protocol request
// 6. hand off to handleAliceProtocolRequest()
// 7. map protocol response to HTTP response
// 8. return JSON-safe result
// 9. never leak internals
// ─────────────────────────────────────────────────────────────

import type { AliceHttpRequestEnvelope, AliceHttpResponseEnvelope, AliceHttpEntryOutcome } from "./types.js";
import type { EntryPattern } from "../alice-bridge/types.js";
import type { AdapterHandlerContext } from "../alice-bridge/adapter.js";
import { buildHttpRequestEnvelope } from "./request.js";
import { validateAliceHttpRequest } from "./validation.js";
import { verifyAliceHttpRequest } from "./security.js";
import { mapHttpRequestToProtocolRequest, mapProtocolResponseToHttpResponse } from "./mapping.js";
import { handleAliceProtocolRequest } from "../alice-protocol/adapter.js";
import { buildJsonOkResponse, buildJsonErrorResponse } from "./response.js";
import {
  buildInvalidMethodResponse,
  buildInvalidContentTypeResponse,
  buildUnauthorizedResponse,
  buildForbiddenResponse,
  buildInternalAdapterErrorResponse,
  buildBadRequestResponse,
} from "./errors.js";
import { runAliceIngressHardening, type HardeningInput } from "../alice-ingress-hardening/adapter.js";

export function handleAliceHttpEntry(
  rawMethod: string,
  rawHeaders: Record<string, string | undefined>,
  rawBody: unknown,
  context?: AdapterHandlerContext,
  entryPatterns?: EntryPattern[],
): AliceHttpResponseEnvelope {
  try {
    // 1. Build HTTP envelope
    const httpEnvelope = buildHttpRequestEnvelope(rawMethod, rawHeaders, rawBody);

    // 2. Validate method
    if (httpEnvelope.method !== "POST") {
      return buildInvalidMethodResponse(rawMethod);
    }

    // 3. Validate content-type
    const ct = rawHeaders["content-type"] ?? rawHeaders["Content-Type"] ?? "";
    if (!ct.toLowerCase().includes("application/json")) {
      return buildInvalidContentTypeResponse(ct);
    }

    // 4. Validate body presence/shape
    const validation = validateAliceHttpRequest(httpEnvelope);
    if (!validation.valid) {
      return buildBadRequestResponse(validation.errors.join(", "));
    }

    // 4b. RUN INGRESS HARDENING (before protocol handoff)
    const hardeningInput: HardeningInput = {
      headers: rawHeaders,
      body: rawBody,
      sessionId: (rawBody as Record<string, unknown>)?.session
        ? ((rawBody as Record<string, unknown>).session as Record<string, unknown>).session_id as string | undefined
        : undefined,
      userId: (rawBody as Record<string, unknown>)?.session
        ? ((rawBody as Record<string, unknown>).session as Record<string, unknown>).user_id as string | undefined
        : undefined,
      contentType: ct,
    };

    const hardeningResult = runAliceIngressHardening(hardeningInput);

    // If hardening rejects the request, return immediately — NO protocol handoff
    if (hardeningResult.shouldReject) {
      if (hardeningResult.reason === "missing_secret") {
        return buildUnauthorizedResponse();
      }
      if (hardeningResult.reason === "invalid_secret") {
        return buildForbiddenResponse();
      }
      if (hardeningResult.reason === "replay_detected") {
        return buildJsonErrorResponse(409, "Replay request detected");
      }
      if (hardeningResult.reason === "rate_limited") {
        return buildJsonErrorResponse(429, "Rate limit exceeded");
      }
      if (hardeningResult.reason === "oversized") {
        return buildJsonErrorResponse(413, "Request too large");
      }
      if (hardeningResult.reason === "malformed" || hardeningResult.reason === "suspicious") {
        return buildBadRequestResponse("Invalid request format");
      }
      // Default: internal error
      return buildInternalAdapterErrorResponse();
    }

    // 5. Run verification gate (legacy security gate, after hardening)
    const verification = verifyAliceHttpRequest(httpEnvelope);
    if (!verification.valid) {
      return verification.reason?.includes("secret") ? buildUnauthorizedResponse() : buildBadRequestResponse(verification.reason ?? "Verification failed");
    }

    // 6. Extract protocol request
    const protocolRequest = mapHttpRequestToProtocolRequest(httpEnvelope);
    if (!protocolRequest) {
      return buildInternalAdapterErrorResponse();
    }

    // 7. Hand off to protocol adapter
    const protocolResponse = handleAliceProtocolRequest(protocolRequest, context, entryPatterns);

    // 8. Map protocol response to HTTP response
    return mapProtocolResponseToHttpResponse(protocolResponse);
  } catch (err) {
    // 9. Never leak internals — safe 500 response
    return buildInternalAdapterErrorResponse(err instanceof Error ? err : undefined);
  }
}
