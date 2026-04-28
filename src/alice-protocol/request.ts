// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Request Helpers
//
// Text extraction from Alice protocol request:
// 1. request.command (primary)
// 2. request.original_utterance (fallback)
// If neither exists → request has no extractable text.
//
// Session meta extraction:
// session.session_id, user_id, new, locale, timezone, version
// ─────────────────────────────────────────────────────────────

import type { AliceProtocolRequest, AliceProtocolSessionMeta } from "./types.js";

export function extractAliceText(request: AliceProtocolRequest): string {
  const command = request.request?.command?.trim();
  if (command && command.length > 0) return command;

  const utterance = request.request?.original_utterance?.trim();
  if (utterance && utterance.length > 0) return utterance;

  return "";
}

export function extractAliceSessionMeta(request: AliceProtocolRequest): AliceProtocolSessionMeta {
  return {
    sessionId: request.session?.session_id ?? "",
    userId: request.session?.user_id,
    isNew: request.session?.new ?? false,
    locale: request.meta?.locale,
    timezone: request.meta?.timezone,
    protocolVersion: request.version ?? "1.0",
  };
}

export function hasExtractableText(request: AliceProtocolRequest): boolean {
  return extractAliceText(request).length > 0;
}

export function isProtocolRequestValid(request: AliceProtocolRequest): boolean {
  // Must have session with session_id
  if (!request.session?.session_id) return false;
  // Must have request object
  if (!request.request) return false;
  // Must have extractable text
  if (!hasExtractableText(request)) return false;
  return true;
}
