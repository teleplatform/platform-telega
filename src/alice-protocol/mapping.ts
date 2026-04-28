// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Response Mapping
//
// Maps AliceBridgeResponse → AliceProtocolResponse.
// Truth-preserving mapping where end_session depends on outcome,
// not on response length or convenience.
//
// Mapping rules:
// - opened → short text, end_session=false
// - forwarded/acknowledged → text present, end_session=false
// - delivered → text present, end_session=false
// - transferred → text present, end_session=false
// - fallback_delivered → text present, end_session depends on rules
// - blocked → safe text, end_session=true
// - failed → safe text, end_session=true
// ─────────────────────────────────────────────────────────────

import type { AliceProtocolResponse } from "./types.js";
import type { AliceBridgeResponse } from "../alice-bridge/types.js";
import { shouldEndAliceSession } from "./closure.js";

export function mapBridgeResponseToProtocolResponse(
  bridgeResponse: AliceBridgeResponse,
  protocolVersion: string = "1.0",
): AliceProtocolResponse {
  const text = bridgeResponse.responseText ?? getDefaultTextForOutcome(bridgeResponse.outcome);
  const endSession = shouldEndAliceSession(bridgeResponse.outcome, bridgeResponse.shouldCloseSession);

  return {
    response: {
      text,
      end_session: endSession,
    },
    session: {
      session_id: bridgeResponse.bridgeSessionId ?? bridgeResponse.requestId,
      user_id: undefined,
      new: false,
    },
    version: protocolVersion,
  };
}

function getDefaultTextForOutcome(outcome: AliceBridgeResponse["outcome"]): string {
  switch (outcome) {
    case "opened":
      return "Сессия открыта.";
    case "forwarded":
      return "Запрос передан в обработку.";
    case "acknowledged":
      return "Поняла.";
    case "delivered":
      return "Ответ доставлен.";
    case "transferred":
      return "Сессия передана на другую поверхность.";
    case "fallback_delivered":
      return "Ответ доставлен через резервный канал.";
    case "blocked":
      return "Сессия заблокирована.";
    case "failed":
      return "Произошла ошибка.";
    default:
      return "Обработка завершена.";
  }
}
