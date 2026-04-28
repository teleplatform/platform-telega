// ─────────────────────────────────────────────────────────────
// TELEGRAM OUTPUT DELIVERY
//
// Pure transport transformation. NO business logic.
// Unified TransportOutput → Telegram API calls.
// ─────────────────────────────────────────────────────────────

import type {
  TransportOutput,
  TransportTextOutput,
  TransportAudioOutput,
  TransportFileOutput,
  TransportImageOutput,
  TransportUiAction,
  TransportDeliveryResult,
} from "../transport.types.js";

interface TelegramBotContext {
  telegram: {
    sendMessage: (chatId: number | string, text: string, opts?: any) => Promise<any>;
    sendVoice: (chatId: number | string, voice: any, opts?: any) => Promise<any>;
    sendDocument: (chatId: number | string, doc: any, opts?: any) => Promise<any>;
    sendPhoto: (chatId: number | string, photo: any, opts?: any) => Promise<any>;
  };
  chat?: { id: number | string };
}

const DEFAULT_PARSE_MODE = "Markdown";

export async function deliverTransportOutput(
  ctx: TelegramBotContext,
  output: TransportOutput
): Promise<TransportDeliveryResult> {
  try {
    switch (output.type) {
      case "text":
        return deliverText(ctx, output);
      case "audio":
        return deliverAudio(ctx, output);
      case "file":
        return deliverFile(ctx, output);
      case "image":
        return deliverImage(ctx, output);
      case "actions":
        return { ok: true };
      default:
        return { ok: false, error: "unknown_output_type" };
    }
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function deliverText(
  ctx: TelegramBotContext,
  output: TransportTextOutput
): Promise<TransportDeliveryResult> {
  const chatId = ctx.chat?.id;
  if (!chatId) return { ok: false, error: "no_chat_id" };

  const msg = await ctx.telegram.sendMessage(chatId, output.text, {
    parse_mode: output.parseMode || DEFAULT_PARSE_MODE,
    disable_web_page_preview: true,
  });

  return { ok: true, messageId: msg?.message_id };
}

async function deliverAudio(
  ctx: TelegramBotContext,
  output: TransportAudioOutput
): Promise<TransportDeliveryResult> {
  const chatId = ctx.chat?.id;
  if (!chatId) return { ok: false, error: "no_chat_id" };

  const voiceInput = { source: Buffer.from(output.buffer) };
  const msg = await ctx.telegram.sendVoice(chatId, voiceInput);

  return { ok: true, messageId: msg?.message_id };
}

async function deliverFile(
  ctx: TelegramBotContext,
  output: TransportFileOutput
): Promise<TransportDeliveryResult> {
  const chatId = ctx.chat?.id;
  if (!chatId) return { ok: false, error: "no_chat_id" };

  const docInput = { source: Buffer.from(output.buffer), filename: output.filename };
  const opts: any = {};
  if (output.caption) opts.caption = output.caption;

  const msg = await ctx.telegram.sendDocument(chatId, docInput, opts);

  return { ok: true, messageId: msg?.message_id };
}

async function deliverImage(
  ctx: TelegramBotContext,
  output: TransportImageOutput
): Promise<TransportDeliveryResult> {
  const chatId = ctx.chat?.id;
  if (!chatId) return { ok: false, error: "no_chat_id" };

  if (output.url) {
    const msg = await ctx.telegram.sendPhoto(chatId, output.url, {
      caption: output.caption,
    });
    return { ok: true, messageId: msg?.message_id };
  }

  if (output.buffer) {
    const msg = await ctx.telegram.sendPhoto(chatId, { source: Buffer.from(output.buffer) }, {
      caption: output.caption,
    });
    return { ok: true, messageId: msg?.message_id };
  }

  return { ok: false, error: "no_image_data" };
}

export function buildTelegramKeyboard(
  actions: TransportUiAction[]
): any {
  const rows = actions.map((action) => {
    if (action.kind === "url") {
      return {
        text: action.label,
        url: String(action.payload?.url || "#"),
      };
    }
    return {
      text: action.label,
      callback_data: action.id,
    };
  });

  return {
    inline_keyboard: [rows],
  };
}