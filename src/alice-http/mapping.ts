// ─────────────────────────────────────────────────────────────
// ALICE WEBHOOK / HTTP ENTRY ADAPTER v1.0 — HTTP↔Protocol Mapping
//
// Maps HTTP request envelope → AliceProtocolRequest
// Maps AliceProtocolResponse → HTTP response envelope
//
// Protocol handoff is mandatory — no bypass allowed.
// ─────────────────────────────────────────────────────────────

import type { AliceHttpRequestEnvelope, AliceHttpResponseEnvelope } from "./types.js";
import type { AliceProtocolRequest, AliceProtocolResponse } from "../alice-protocol/types.js";

export function mapHttpRequestToProtocolRequest(
  httpEnvelope: AliceHttpRequestEnvelope,
): AliceProtocolRequest | null {
  if (!httpEnvelope.body) return null;

  const body = httpEnvelope.body as Record<string, unknown>;

  return {
    meta: (body.meta as Record<string, unknown> | undefined) ?? {},
    session: {
      session_id: ((body.session as Record<string, unknown>)?.session_id as string) ?? "",
      user_id: ((body.session as Record<string, unknown>)?.user_id as string | undefined),
      new: ((body.session as Record<string, unknown>)?.new as boolean | undefined) ?? false,
    },
    request: {
      command: ((body.request as Record<string, unknown>)?.command as string | undefined),
      original_utterance: ((body.request as Record<string, unknown>)?.original_utterance as string | undefined),
      type: ((body.request as Record<string, unknown>)?.type as string | undefined),
    },
    version: body.version as string | undefined,
    rawPayload: body,
  };
}

export function mapProtocolResponseToHttpResponse(
  protocolResponse: AliceProtocolResponse,
): AliceHttpResponseEnvelope {
  return {
    statusCode: 200,
    contentType: "application/json",
    body: protocolResponse as unknown as Record<string, unknown>,
  };
}
