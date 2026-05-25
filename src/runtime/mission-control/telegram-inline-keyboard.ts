import type { ReplayApprovalRequest } from "../evidence/replay-approval-queue.js";
import type { ExecutionApprovalRequest } from "../policy/execution-approval-queue.js";
import type { IncidentApproval } from "../incidents/incident-approval-gate.js";
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
  buttons: Array<{ label: string; callback_data: string }>,
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
  const text = [
    "Replay approval required",
    "",
    `approval_id: ${request.approval_id}`,
    `trace_id: ${request.trace_id}`,
    `reason: ${request.replay_reason || "-"}`,
    `requested_by: ${request.requested_by}`,
    `target_override: ${request.target_override || "-"}`,
    `force: ${request.force ? "yes" : "no"}`,
    `expires_at: ${request.expires_at || "-"}`,
  ].join("\n");
  const markup = toTelegramInlineKeyboard([
    { label: "Approve", callback_data: `replay:approve:${request.approval_id}` },
    { label: "Deny", callback_data: `replay:deny:${request.approval_id}` },
    { label: "Execute", callback_data: `replay:execute:${request.approval_id}` },
    { label: "Notify again", callback_data: `replay:notify:${request.approval_id}` },
  ]);

  return {
    chat_id: chatId,
    text,
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

export function renderExecutionApprovalTelegramMessage(
  request: ExecutionApprovalRequest,
  chatId: string,
): TelegramMissionControlMessage {
  return {
    chat_id: chatId,
    text: [
      "Execution approval required",
      "",
      `approval_id: ${request.approval_id}`,
      `task_kind: ${request.task_kind}`,
      `target: ${request.target || "-"}`,
      `reason: ${request.reason}`,
      `requested_by: ${request.requested_by}`,
      `trace_id: ${request.trace_id || "-"}`,
      `expires_at: ${request.expires_at || "-"}`,
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Approve", callback_data: `execution:approve:${request.approval_id}` },
          { text: "Deny", callback_data: `execution:deny:${request.approval_id}` },
        ],
        [
          { text: "Consume", callback_data: `execution:consume:${request.approval_id}` },
          { text: "Notify again", callback_data: `execution:notify:${request.approval_id}` },
        ],
      ],
    },
  };
}

export async function renderAndEmitExecutionTelegramKeyboard(
  request: ExecutionApprovalRequest,
  chatId: string,
): Promise<TelegramMissionControlMessage> {
  const message = renderExecutionApprovalTelegramMessage(request, chatId);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(request.approval_id, "telegram_inline_keyboard_rendered"),
    trace_id: request.trace_id || request.approval_id,
    job_id: request.approval_id,
    type: "telegram_inline_keyboard_rendered",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: request.approval_id,
      approval_kind: "execution",
      chat_id: chatId,
      text: message.text,
      reply_markup: message.reply_markup,
    },
  });
  return message;
}

export function renderIncidentApprovalTelegramMessage(
  approval: IncidentApproval,
  chatId: string,
): TelegramMissionControlMessage {
  return {
    chat_id: chatId,
    text: [
      "Incident approval required",
      "",
      `approval_id: ${approval.approval_id}`,
      `incident_id: ${approval.incident_id}`,
      `action: ${approval.action}`,
      `status: ${approval.status}`,
      `requested_at: ${approval.requested_at}`,
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Grant", callback_data: `incident:grant:${approval.approval_id}` },
          { text: "Deny", callback_data: `incident:deny:${approval.approval_id}` },
        ],
      ],
    },
  };
}

export async function renderAndEmitIncidentTelegramKeyboard(
  approval: IncidentApproval,
  chatId: string,
): Promise<TelegramMissionControlMessage> {
  const message = renderIncidentApprovalTelegramMessage(approval, chatId);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(approval.approval_id, "telegram_inline_keyboard_rendered"),
    trace_id: approval.approval_id,
    job_id: approval.approval_id,
    type: "telegram_inline_keyboard_rendered",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: approval.approval_id,
      approval_kind: "incident",
      incident_id: approval.incident_id,
      chat_id: chatId,
      text: message.text,
      reply_markup: message.reply_markup,
    },
  });
  return message;
}
