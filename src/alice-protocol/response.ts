// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Response Builders
//
// Builds protocol-safe Alice response envelopes.
// response.text must never be empty.
// response.end_session must always be boolean.
// ─────────────────────────────────────────────────────────────

import type { AliceProtocolResponse } from "./types.js";

export function buildAliceProtocolResponse(input: {
  sessionId: string;
  userId?: string;
  isNew?: boolean;
  text: string;
  endSession: boolean;
  version?: string;
}): AliceProtocolResponse {
  if (!input.text || input.text.trim().length === 0) {
    throw new Error("response.text must not be empty");
  }

  return {
    response: {
      text: input.text.trim(),
      end_session: input.endSession,
    },
    session: {
      session_id: input.sessionId,
      user_id: input.userId,
      new: input.isNew ?? false,
    },
    version: input.version ?? "1.0",
  };
}

export function buildSafeProtocolErrorResponse(input: {
  sessionId: string;
  userId?: string;
  text?: string;
  version?: string;
}): AliceProtocolResponse {
  return {
    response: {
      text: input.text?.trim() ?? "Произошла ошибка обработки запроса.",
      end_session: true,
    },
    session: {
      session_id: input.sessionId,
      user_id: input.userId,
      new: false,
    },
    version: input.version ?? "1.0",
  };
}
