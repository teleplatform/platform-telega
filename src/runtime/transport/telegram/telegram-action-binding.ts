// ─────────────────────────────────────────────────────────────
// TELEGRAM ACTION BINDING
//
// Pure action binding. NO business logic.
// Telegram callback → unified TransportInput(action).
// ─────────────────────────────────────────────────────────────

import { normalizeTelegramCallback } from "./telegram-input-normalizer.js";

interface TelegramCallbackContext {
  callbackQuery?: {
    id: string;
    data?: string;
    from?: { id: number | string };
  };
  chat?: { id: number | string };
}

export function extractTelegramAction(ctx: TelegramCallbackContext): string | null {
  return ctx.callbackQuery?.data || null;
}

export function extractTelegramActionUserId(ctx: TelegramCallbackContext): string {
  return String(ctx.callbackQuery?.from?.id ?? "");
}

export async function handleTelegramCallback(
  ctx: TelegramCallbackContext
): Promise<{ action: string; userId: string; chatId: string } | null> {
  const input = normalizeTelegramCallback(ctx);
  if (!input || input.type !== "action") return null;

  return {
    action: input.action,
    userId: input.userId,
    chatId: String(input.chatId ?? ""),
  };
}