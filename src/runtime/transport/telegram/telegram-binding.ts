// ─────────────────────────────────────────────────────────────
// TELEGRAM BINDING — ENTRY POINT
//
// Strict transport binding. NO business logic.
// Telegram update → chat-surface → unified output → Telegram delivery.
//
// Flow:
//   Telegram Update
//     → normalizeTelegramUpdate
//     → routeInput (chat-surface-router)
//     → routeOutput (chat-surface-router)
//     → deliverTransportOutput (telegram-output-delivery)
// ─────────────────────────────────────────────────────────────

import { normalizeTelegramUpdate, normalizeTelegramCallback } from "./telegram-input-normalizer.js";
import { deliverTransportOutput, buildTelegramKeyboard } from "./telegram-output-delivery.js";
import { routeInput, routeOutput, executeSurfaceAction } from "../../chat-surface/index.js";
import type { TransportInput, TransportActionInput } from "../transport.types.js";
import type { ChatActionType } from "../../chat-surface/chat-surface.types.js";

interface TelegramUpdateContext {
  from?: { id: number | string };
  chat?: { id: number | string };
  message?: {
    text?: string;
    voice?: { file_id: string; duration?: number };
    document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
  };
  callback_query?: { id: string; data?: string; from?: { id: number | string } };
  message_id?: number | string;
}

const ACTION_MAP: Record<string, ChatActionType> = {
  read_aloud: "read_aloud",
  voice_input: "voice_input",
  generate_image: "generate_image",
  new_chat: "new_chat",
  archive_chat: "archive_chat",
};

export async function handleTelegramUpdate(ctx: TelegramUpdateContext): Promise<void> {
  const input = normalizeTelegramUpdate(ctx);
  if (!input) return;

  await processTransportInput(ctx, input);
}

export async function handleTelegramCallbackQuery(ctx: TelegramUpdateContext): Promise<void> {
  const input = normalizeTelegramCallback(ctx);
  if (!input || input.type !== "action") return;

  const actionInput = input as TransportActionInput;
  const chatActionType = ACTION_MAP[actionInput.action] as ChatActionType | undefined;
  if (chatActionType) {
    await executeSurfaceAction({
      userId: actionInput.userId,
      chatId: String(actionInput.chatId ?? ""),
      action: chatActionType,
      payload: actionInput.payload,
    });
  }
}

async function processTransportInput(
  ctx: TelegramUpdateContext,
  input: TransportInput
): Promise<void> {
  try {
    const routeResult = await routeInput({
      type: input.type,
      text: input.type === "text" ? input.text : undefined,
      voiceFileId: input.type === "voice" ? input.fileId : undefined,
      fileId: input.type === "file" ? input.fileId : undefined,
      fileName: input.type === "file" ? input.fileName : undefined,
      mimeType: input.type === "file" ? input.mimeType : undefined,
      chatId: input.chatId,
      userId: input.userId,
    });

    if (!routeResult.ok) {
      console.error("[telegram-binding] routeInput failed:", routeResult.error);
      return;
    }

    const output = await routeOutput({
      text: routeResult.normalizedText || routeResult.attachedContent || "",
      userId: input.userId,
      chatId: String(input.chatId ?? ""),
    });

    if (output.ok && output.outputs.length > 0) {
      await deliverTransportOutput(ctx, output.outputs[0]);
    }
  } catch (e) {
    console.error("[telegram-binding] error:", e);
  }
}

export function bindTelegramBot(bot: any): void {
  bot.on("message", async (ctx: TelegramUpdateContext) => {
    await handleTelegramUpdate(ctx);
  });

  bot.on("callback_query", async (ctx: TelegramUpdateContext) => {
    await handleTelegramCallbackQuery(ctx);
  });
}