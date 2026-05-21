import type { LearningApprovalRequest } from "./learning-approval-queue.js";
import type { TelegramMissionControlMessage, TelegramInlineKeyboardMarkup } from "../mission-control/telegram-inline-keyboard.js";
import { sendTelegramMissionControlMessage, loadTelegramSenderConfig } from "../mission-control/telegram-sender.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface LearningProposalButton {
  label: string;
  callback_data: string;
}

export interface LearningProposalRenderResult {
  text: string;
  buttons: LearningProposalButton[];
}

export function renderLearningProposalMessage(
  request: LearningApprovalRequest,
): LearningProposalRenderResult {
  const lines: string[] = [];
  lines.push(`LEARNING PROPOSAL`);
  lines.push(`─`.repeat(50));
  lines.push(`ID:          ${request.approval_id}`);
  lines.push(`Proposal:    ${request.proposal_id}`);
  lines.push(`Type:        ${request.type}`);
  lines.push(`Severity:    ${request.severity}`);
  lines.push(`Title:       ${request.title}`);
  lines.push(`Description: ${request.description}`);
  lines.push(`Trace:       ${request.trace_id}`);
  lines.push(`Status:      ${request.status}`);
  lines.push(`Created:     ${request.created_at}`);
  lines.push(`Expires:     ${request.expires_at || "-"}`);
  lines.push(`─`.repeat(50));
  lines.push(`Action required: approve or deny this proposal.`);

  const buttons: LearningProposalButton[] = [
    { label: "Approve", callback_data: `learning:approve:${request.approval_id}` },
    { label: "Deny", callback_data: `learning:deny:${request.approval_id}` },
    { label: "View evidence", callback_data: `learning:evidence:${request.approval_id}` },
    { label: "Convert to issue", callback_data: `learning:issue:${request.approval_id}` },
  ];

  return { text: lines.join("\n"), buttons };
}

export function learningProposalToTelegramMessage(
  request: LearningApprovalRequest,
  chatId: string,
): TelegramMissionControlMessage {
  const rendered = renderLearningProposalMessage(request);
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: rendered.buttons[0].label, callback_data: rendered.buttons[0].callback_data },
        { text: rendered.buttons[1].label, callback_data: rendered.buttons[1].callback_data },
      ],
      [
        { text: rendered.buttons[2].label, callback_data: rendered.buttons[2].callback_data },
        { text: rendered.buttons[3].label, callback_data: rendered.buttons[3].callback_data },
      ],
    ],
  };

  return {
    chat_id: chatId,
    text: rendered.text,
    reply_markup: keyboard,
  };
}

export async function renderAndSendLearningProposal(
  request: LearningApprovalRequest,
  chatId?: string,
): Promise<{ ok: boolean; message?: TelegramMissionControlMessage; error?: string }> {
  const cfg = loadTelegramSenderConfig();
  const targetChatId = chatId || cfg.default_chat_id || "";
  if (!targetChatId) {
    return { ok: false, error: "no chat_id" };
  }

  const message = learningProposalToTelegramMessage(request, targetChatId);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(request.approval_id, "learning_proposal_rendered"),
    trace_id: request.trace_id,
    job_id: request.source_job_id,
    type: "learning_proposal_rendered",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: request.approval_id,
      proposal_id: request.proposal_id,
      chat_id: targetChatId,
    },
  });

  const sendResult = await sendTelegramMissionControlMessage(message, cfg);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(request.approval_id, "learning_proposal_notification_sent"),
    trace_id: request.trace_id,
    job_id: request.source_job_id,
    type: "learning_proposal_notification_sent",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: request.approval_id,
      proposal_id: request.proposal_id,
      telegram_ok: sendResult.ok,
      dry_run: sendResult.dry_run,
    },
  });

  return { ok: sendResult.ok, message };
}
