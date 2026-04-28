// ─────────────────────────────────────────────────────────────
// TELEGRAM INPUT NORMALIZER
//
// Pure transport transformation. NO business logic.
// Telegram update → unified TransportInput contract.
// ─────────────────────────────────────────────────────────────

import type {
  TransportInput,
  TransportTextInput,
  TransportVoiceInput,
  TransportFileInput,
} from "../transport.types.js";

interface TelegramUpdateContext {
  from?: { id: number | string };
  message?: {
    text?: string;
    voice?: { file_id: string; duration?: number };
    document?: {
      file_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
  };
  callback_query?: { data?: string; from?: { id: number | string } };
  chat?: { id: number | string };
  message_id?: number | string;
}

export function normalizeTelegramUpdate(
  ctx: TelegramUpdateContext
): TransportInput | null {
  const userId = String(ctx.from?.id ?? ctx.callback_query?.from?.id ?? "");
  const chatId = String(ctx.chat?.id ?? "");

  if (ctx.message?.text) {
    const input: TransportTextInput = {
      type: "text",
      text: ctx.message.text,
      userId,
      chatId: chatId || undefined,
      messageId: String(ctx.message_id ?? ""),
      surface: "telegram",
    };
    return input;
  }

  if (ctx.message?.voice) {
    const input: TransportVoiceInput = {
      type: "voice",
      fileId: ctx.message.voice.file_id,
      userId,
      chatId: chatId || undefined,
      duration: ctx.message.voice.duration,
      surface: "telegram",
    };
    return input;
  }

  if (ctx.message?.document) {
    const input: TransportFileInput = {
      type: "file",
      fileId: ctx.message.document.file_id,
      fileName: ctx.message.document.file_name,
      mimeType: ctx.message.document.mime_type,
      userId,
      chatId: chatId || undefined,
      size: ctx.message.document.file_size,
      surface: "telegram",
    };
    return input;
  }

  return null;
}

export function normalizeTelegramCallback(
  ctx: TelegramUpdateContext
): TransportInput | null {
  const data = ctx.callback_query?.data;
  if (!data) return null;

  const userId = String(ctx.callback_query?.from?.id ?? "");
  const chatId = String(ctx.chat?.id ?? "");

  return {
    type: "action",
    action: data,
    userId,
    chatId: chatId || undefined,
    surface: "telegram",
  };
}