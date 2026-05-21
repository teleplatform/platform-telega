import type { CompletionReport } from "./completion-report-renderer.js";
import { buildCompletionReport, renderCompletionReportText } from "./completion-report-renderer.js";
import { sendTelegramMissionControlMessage, loadTelegramSenderConfig } from "../mission-control/telegram-sender.js";
import type { TelegramMissionControlMessage, TelegramInlineKeyboardMarkup } from "../mission-control/telegram-inline-keyboard.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface CompletionTelegramResult {
  ok: boolean;
  report?: CompletionReport;
  telegram?: { ok: boolean; dry_run: boolean; chat_id?: string; message_id?: number; error?: string };
}

function buildCompletionKeyboard(report: CompletionReport): TelegramInlineKeyboardMarkup {
  const rows: Array<{ text: string; callback_data: string }[]> = [];
  const buttons: { text: string; callback_data: string }[] = [];

  buttons.push({
    text: "View trace",
    callback_data: `completion:view_trace:${report.trace_id}`,
  });

  buttons.push({
    text: "View artifacts",
    callback_data: `completion:view_artifacts:${report.trace_id}`,
  });

  buttons.push({
    text: "Replay",
    callback_data: `completion:replay:${report.trace_id}`,
  });

  if (report.rollback_plan) {
    buttons.push({
      text: "Rollback",
      callback_data: `completion:rollback:${report.trace_id}`,
    });
  }

  rows.push([buttons[0], buttons[1]]);
  if (buttons.length > 3) {
    rows.push([buttons[2], buttons[3]]);
  } else {
    rows.push([buttons[2]]);
  }

  return { inline_keyboard: rows };
}

export function buildCompletionTelegramMessage(report: CompletionReport, chatId: string): TelegramMissionControlMessage {
  const text = renderCompletionReportText(report);
  const reply_markup = buildCompletionKeyboard(report);

  return {
    chat_id: chatId,
    text,
    reply_markup,
  };
}

export async function sendCompletionReportToTelegram(
  traceId: string,
  chatId?: string,
): Promise<CompletionTelegramResult> {
  const report = buildCompletionReport(traceId);
  if (!report) {
    return { ok: false };
  }

  const cfg = loadTelegramSenderConfig();
  const targetChatId = chatId || cfg.default_chat_id || "";
  if (!targetChatId) {
    return { ok: false, report, telegram: { ok: false, dry_run: false, error: "no chat_id" } };
  }

  const message = buildCompletionTelegramMessage(report, targetChatId);
  const sendResult = await sendTelegramMissionControlMessage(message, cfg);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "completion_report_sent"),
    trace_id: traceId,
    job_id: report.job_id,
    type: "completion_report_sent",
    timestamp: new Date().toISOString(),
    payload: {
      chat_id: targetChatId,
      final_status: report.final_status,
      risk_level: report.risk_level,
      dry_run: sendResult.dry_run,
      telegram_ok: sendResult.ok,
      message_id: sendResult.message_id,
    },
  });

  return {
    ok: sendResult.ok,
    report,
    telegram: sendResult,
  };
}
