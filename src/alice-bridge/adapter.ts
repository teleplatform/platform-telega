// ─────────────────────────────────────────────────────────────
// ALICE VOICE BRIDGE ADAPTER v1.0 — Main Handler
//
// handleAliceVoiceRequest() does ONLY:
// 1. normalize input
// 2. validate input
// 3. detect entry type
// 4. open/bind session if needed
// 5. forward into runtime (simulated in v1)
// 6. map runtime result into AliceBridgeResponse
// 7. preserve transport truth
// 8. never invent success
// ─────────────────────────────────────────────────────────────

import type {
  AliceVoiceRequest,
  AliceVoiceNormalizedInput,
  AliceBridgeSession,
  AliceBridgeResponse,
  EntryPattern,
} from "./types.js";
import { normalizeAliceRequest } from "./normalization.js";
import { openAliceBridgeSession, bindRuntimeSession } from "./entry.js";
import { buildDeliveredResponse, buildForwardedResponse, buildAckResponse, buildOpenedResponse } from "./delivery.js";
import { buildFallbackResponse, canFallbackFromAlice } from "./fallback.js";
import { buildInterruptedResponse, buildFailedResponse } from "./interruptions.js";
import { assertAliceTransportTruth, buildTruthSummary } from "./truth.js";
import { getSupportedEntryPatterns } from "./selectors.js";

export type AdapterHandlerContext = {
  simulatedRuntimeOutcome?: "delivered" | "forwarded" | "acknowledged" | "blocked" | "failed" | "fallback";
  simulatedRuntimeText?: string;
  simulatedRuntimeSessionId?: string;
};

export function handleAliceVoiceRequest(
  request: AliceVoiceRequest,
  context?: AdapterHandlerContext,
  entryPatterns?: EntryPattern[],
): AliceBridgeResponse {
  // 1. Normalize input
  const patterns = entryPatterns ?? getSupportedEntryPatterns("ru");
  const normalized = normalizeAliceRequest(request, patterns);

  // 2. Validate input
  if (!normalized.valid) {
    return buildFailedResponse({
      requestId: request.requestId,
      reason: `Invalid input: ${normalized.validationErrors?.join(", ")}`,
    });
  }

  // 3. Detect entry type and open session
  const session = openAliceBridgeSession({
    aliceSessionId: request.aliceSessionId,
    userId: request.userId,
    languageCode: normalized.languageCode,
    arishaEntryDetected: normalized.entryIntent === "arisha_entry",
  });

  // 4. Bind runtime session if simulated
  if (context?.simulatedRuntimeSessionId) {
    bindRuntimeSession(session, context.simulatedRuntimeSessionId);
  }

  // 5-6. Map simulated runtime result to AliceBridgeResponse
  const outcome = context?.simulatedRuntimeOutcome ?? "forwarded";

  switch (outcome) {
    case "delivered":
      return buildDeliveredResponse({
        requestId: request.requestId,
        bridgeSessionId: session.bridgeSessionId,
        runtimeSessionId: session.runtimeSessionId,
        responseText: context?.simulatedRuntimeText ?? "Response delivered",
        truthSummary: buildTruthSummary("delivered", session.bridgeSessionId, session.runtimeSessionId),
      });

    case "forwarded":
      return buildForwardedResponse({
        requestId: request.requestId,
        bridgeSessionId: session.bridgeSessionId,
        runtimeSessionId: session.runtimeSessionId,
        truthSummary: buildTruthSummary("forwarded", session.bridgeSessionId, session.runtimeSessionId),
      });

    case "acknowledged":
      return buildAckResponse({
        requestId: request.requestId,
        bridgeSessionId: session.bridgeSessionId,
        runtimeSessionId: session.runtimeSessionId,
        responseText: context?.simulatedRuntimeText ?? "Ack",
      });

    case "blocked":
      return buildInterruptedResponse({
        requestId: request.requestId,
        bridgeSessionId: session.bridgeSessionId,
        runtimeSessionId: session.runtimeSessionId,
        reason: "Runtime blocked the request",
      });

    case "failed":
      return buildFailedResponse({
        requestId: request.requestId,
        bridgeSessionId: session.bridgeSessionId,
        runtimeSessionId: session.runtimeSessionId,
        reason: "Runtime failed to process the request",
      });

    case "fallback":
      return buildFallbackResponse({
        requestId: request.requestId,
        bridgeSessionId: session.bridgeSessionId,
        runtimeSessionId: session.runtimeSessionId,
        fallbackTarget: { surface: "text", reason: "Voice delivery not available" },
        responseText: context?.simulatedRuntimeText,
        truthSummary: buildTruthSummary("fallback_delivered", session.bridgeSessionId, session.runtimeSessionId),
      });

    default:
      return buildFailedResponse({
        requestId: request.requestId,
        reason: `Unknown runtime outcome: ${outcome}`,
      });
  }
}
