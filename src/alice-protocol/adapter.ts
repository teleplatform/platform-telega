// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Main Handler
//
// handleAliceProtocolRequest() does ONLY:
// 1. parse protocol request
// 2. extract session meta
// 3. normalize request
// 4. validate request
// 5. hand off to Alice bridge adapter
// 6. map bridge response to Alice protocol response
// 7. set truthful end_session
// 8. never invent runtime success
// ─────────────────────────────────────────────────────────────

import type {
  AliceProtocolRequest,
  AliceProtocolResponse,
  AliceProtocolNormalizedRequest,
  EntryPattern,
} from "./types.js";
import { extractAliceText, extractAliceSessionMeta, hasExtractableText } from "./request.js";
import { normalizeAliceProtocolRequest } from "./normalization.ts";
import { mapBridgeResponseToProtocolResponse } from "./mapping.ts";
import { buildSafeProtocolErrorResponse } from "./response.ts";
import { handleAliceVoiceRequest, AdapterHandlerContext } from "../alice-bridge/adapter.js";

export function handleAliceProtocolRequest(
  request: AliceProtocolRequest,
  context?: AdapterHandlerContext,
  entryPatterns?: EntryPattern[],
): AliceProtocolResponse {
  // 1. Parse protocol request — extract session meta
  const sessionMeta = extractAliceSessionMeta(request);

  // 2. Check if text is extractable
  if (!hasExtractableText(request)) {
    // Invalid request — return safe error response
    return buildSafeProtocolErrorResponse({
      sessionId: sessionMeta.sessionId || "unknown",
      userId: sessionMeta.userId,
      text: "Не удалось распознать запрос.",
      version: sessionMeta.protocolVersion,
    });
  }

  // 3. Normalize request
  const normalized = normalizeAliceProtocolRequest(request, entryPatterns);

  // 4. Validate request
  if (!normalized.valid) {
    return buildSafeProtocolErrorResponse({
      sessionId: sessionMeta.sessionId,
      userId: sessionMeta.userId,
      text: "Запрос не прошёл валидацию.",
      version: sessionMeta.protocolVersion,
    });
  }

  // 5. Hand off to Alice bridge adapter
  const bridgeRequest = {
    requestId: normalized.protocolRequestId,
    aliceSessionId: sessionMeta.sessionId,
    userId: sessionMeta.userId,
    inputText: normalized.text,
    locale: sessionMeta.locale,
  };

  const bridgeResponse = handleAliceVoiceRequest(bridgeRequest, context, entryPatterns);

  // 6. Map bridge response to Alice protocol response
  const protocolResponse = mapBridgeResponseToProtocolResponse(
    bridgeResponse,
    sessionMeta.protocolVersion,
  );

  // 7. Ensure session_id is preserved
  protocolResponse.session.session_id = sessionMeta.sessionId;
  if (sessionMeta.userId) {
    protocolResponse.session.user_id = sessionMeta.userId;
  }

  // 8. Return — runtime success never invented here
  return protocolResponse;
}
