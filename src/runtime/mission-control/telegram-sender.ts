import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { TelegramMissionControlMessage } from "./telegram-inline-keyboard.js";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

export interface TelegramSenderConfig {
  bot_token?: string;
  default_chat_id?: string;
  enabled: boolean;
  dry_run?: boolean;
}

export interface TelegramSendResult {
  ok: boolean;
  dry_run: boolean;
  chat_id?: string;
  message_id?: number;
  error?: string;
}

export interface TelegramConfigValidationResult {
  ok: boolean;
  enabled: boolean;
  dry_run: boolean;
  has_bot_token: boolean;
  has_chat_id: boolean;
  send_test?: TelegramSendResult;
  errors: string[];
}

export interface TelegramEditMessagePayload {
  chat_id: string | number;
  message_id: number;
  text: string;
  reply_markup?: TelegramMissionControlMessage["reply_markup"];
}

export interface TelegramEditResult {
  ok: boolean;
  dry_run: boolean;
  chat_id?: string;
  message_id?: number;
  error?: string;
}

export function loadTelegramSenderConfig(): TelegramSenderConfig {
  return {
    bot_token: process.env.TELEGRAM_MISSION_CONTROL_BOT_TOKEN,
    default_chat_id: process.env.TELEGRAM_MISSION_CONTROL_CHAT_ID,
    enabled: process.env.TELEGRAM_MISSION_CONTROL_ENABLED === "true",
    dry_run: process.env.TELEGRAM_MISSION_CONTROL_DRY_RUN !== "false",
  };
}

export async function validateTelegramMissionControlConfig(input?: {
  send_test?: boolean;
  config?: TelegramSenderConfig;
}): Promise<TelegramConfigValidationResult> {
  const cfg = input?.config || loadTelegramSenderConfig();
  const errors: string[] = [];
  const hasToken = !!cfg.bot_token;
  const hasChatId = !!cfg.default_chat_id;

  if (!cfg.dry_run && !hasToken) errors.push("missing bot token");
  if (!hasChatId) errors.push("missing chat id");

  let sendTest: TelegramSendResult | undefined;
  if (input?.send_test) {
    const chatId = cfg.default_chat_id || "0";
    sendTest = await sendTelegramMissionControlMessage(
      {
        chat_id: chatId,
        text: [
          "Mission Control config validation",
          "",
          `enabled: ${cfg.enabled}`,
          `dry_run: ${cfg.dry_run !== false}`,
          `checked_at: ${new Date().toISOString()}`,
        ].join("\n"),
      },
      { ...cfg, enabled: true, dry_run: cfg.dry_run !== false || !hasToken },
    );
    if (!sendTest.ok) errors.push(sendTest.error || "test send failed");
  }

  return {
    ok: errors.length === 0 || cfg.dry_run !== false,
    enabled: cfg.enabled,
    dry_run: cfg.dry_run !== false,
    has_bot_token: hasToken,
    has_chat_id: hasChatId,
    send_test: sendTest,
    errors,
  };
}

const sentEvidence = new Set<string>();

export async function sendTelegramMissionControlMessage(
  message: TelegramMissionControlMessage,
  config?: TelegramSenderConfig,
): Promise<TelegramSendResult> {
  const cfg = config || loadTelegramSenderConfig();

  if (!cfg.enabled) {
    console.log(`[telegram-sender] disabled — skipping message to ${message.chat_id}`);
    return { ok: false, dry_run: false, error: "disabled" };
  }

  if (cfg.dry_run) {
    console.log(`[telegram-sender] [DRY RUN] would send to chat=${message.chat_id}`);
    console.log(`[telegram-sender] [DRY RUN] text length=${message.text.length}`);
    if (message.reply_markup) {
      console.log(`[telegram-sender] [DRY RUN] inline_keyboard=${JSON.stringify(message.reply_markup.inline_keyboard)}`);
    }
    return { ok: true, dry_run: true, chat_id: message.chat_id };
  }

  const token = cfg.bot_token;
  if (!token) {
    return { ok: false, dry_run: false, error: "missing bot_token" };
  }

  try {
    const url = `${TELEGRAM_API_BASE}${token}/sendMessage`;
    const body = {
      chat_id: message.chat_id,
      text: message.text,
      parse_mode: "HTML",
      reply_markup: message.reply_markup,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json() as any;

    if (data.ok) {
      const result: TelegramSendResult = {
        ok: true,
        dry_run: false,
        chat_id: message.chat_id,
        message_id: data.result?.message_id,
      };

      const dedupKey = `${message.chat_id}:${message.text.slice(0, 40)}`;
      if (!sentEvidence.has(dedupKey)) {
        sentEvidence.add(dedupKey);
        await appendEvidenceRecord({
          evidence_id: hashTraceId(result.chat_id || "?", "telegram_mission_control_message_sent"),
          trace_id: result.chat_id || "?",
          job_id: String(result.message_id || ""),
          type: "telegram_mission_control_message_sent",
          timestamp: new Date().toISOString(),
          payload: {
            dry_run: false,
            chat_id: message.chat_id,
            ok: true,
            message_id: result.message_id,
          },
        });
      }

      return result;
    }

    return { ok: false, dry_run: false, chat_id: message.chat_id, error: data.description || "telegram_error" };
  } catch (e: any) {
    return { ok: false, dry_run: false, chat_id: message.chat_id, error: e.message };
  }
}

export async function editTelegramMissionControlMessage(
  payload: TelegramEditMessagePayload,
  config?: TelegramSenderConfig,
): Promise<TelegramEditResult> {
  const cfg = config || loadTelegramSenderConfig();

  if (!cfg.enabled) {
    console.log(`[telegram-sender] disabled — skipping edit for message ${payload.message_id}`);
    return { ok: false, dry_run: false, error: "disabled" };
  }

  if (cfg.dry_run) {
    console.log(`[telegram-sender] [DRY RUN] would edit message chat=${payload.chat_id} msg=${payload.message_id}`);
    console.log(`[telegram-sender] [DRY RUN] new text=${payload.text.slice(0, 80)}`);
    return { ok: true, dry_run: true, chat_id: String(payload.chat_id), message_id: payload.message_id };
  }

  const token = cfg.bot_token;
  if (!token) {
    return { ok: false, dry_run: false, error: "missing bot_token" };
  }

  try {
    const url = `${TELEGRAM_API_BASE}${token}/editMessageText`;
    const body: Record<string, unknown> = {
      chat_id: payload.chat_id,
      message_id: payload.message_id,
      text: payload.text,
      parse_mode: "HTML",
    };
    if (payload.reply_markup) {
      body.reply_markup = payload.reply_markup;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json() as any;

    const result: TelegramEditResult = {
      ok: data.ok === true,
      dry_run: false,
      chat_id: String(payload.chat_id),
      message_id: payload.message_id,
      error: data.ok ? undefined : (data.description || "telegram_error"),
    };

    await appendEvidenceRecord({
      evidence_id: hashTraceId(String(payload.chat_id), "telegram_mission_control_message_edited"),
      trace_id: String(payload.chat_id),
      job_id: String(payload.message_id),
      type: "telegram_mission_control_message_edited",
      timestamp: new Date().toISOString(),
      payload: {
        chat_id: payload.chat_id,
        message_id: payload.message_id,
        text: payload.text,
        ok: result.ok,
        error: result.error,
      },
    });

    return result;
  } catch (e: any) {
    return { ok: false, dry_run: false, chat_id: String(payload.chat_id), message_id: payload.message_id, error: e.message };
  }
}
