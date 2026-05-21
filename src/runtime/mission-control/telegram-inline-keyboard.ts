import type { ReplayApprovalRequest } from "../evidence/replay-approval-queue.js";
import type { ReplayApprovalButton } from "../evidence/replay-approval-renderer.js";
import { renderReplayApprovalMessage } from "../evidence/replay-approval-renderer.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramMissionControlMessage {
  chat_id: string;
  text: string;
  reply_markup?: TelegramInlineKeyboardMarkup;
}

const BUTTON_LAYOUT: Array<[number, number]> = [[0, 1], [2, 3]];

export function toTelegramInlineKeyboard(
  buttons: ReplayApprovalButton[],
): TelegramInlineKeyboardMarkup {
  const inline_keyboard: TelegramInlineKeyboardButton[][] = [];

  for (const row of BUTTON_LAYOUT) {
    const rowButtons: TelegramInlineKeyboardButton[] = [];
    for (const idx of row) {
      if (idx < buttons.length) {
        rowButtons.push({
          text: buttons[idx].label,
          callback_data: buttons[idx].callback_data,
        });
      }
    }
    if (rowButtons.length > 0) {
      inline_keyboard.push(rowButtons);
    }
  }

  return { inline_keyboard };
}

export function renderReplayApprovalTelegramMessage(
  request: ReplayApprovalRequest,
  chatId: string,
): TelegramMissionControlMessage {
  const rendered = renderReplayApprovalMessage(request);
  const markup = toTelegramInlineKeyboard(rendered.buttons);

  return {
    chat_id: chatId,
    text: rendered.text,
    reply_markup: markup,
  };
}

export async function renderAndEmitTelegramKeyboard(
  request: ReplayApprovalRequest,
  chatId: string,
): Promise<TelegramMissionControlMessage> {
  const message = renderReplayApprovalTelegramMessage(request, chatId);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(request.approval_id, "telegram_inline_keyboard_rendered"),
    trace_id: request.trace_id,
    job_id: request.approval_id,
    type: "telegram_inline_keyboard_rendered",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: request.approval_id,
      chat_id: chatId,
      text: message.text,
      reply_markup: message.reply_markup,
    },
  });

  return message;
}
