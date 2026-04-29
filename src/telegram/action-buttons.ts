import fs from "fs/promises";
import path from "path";
import { Language, detectLanguage, t } from "../providers/creator/i18n.js";
import { Markup } from "telegraf";

const DATA_DIR = path.join(process.cwd(), "data", "telegram");

export type ActionType = "repeat" | "clarify" | "file" | "read_aloud" | "image" | "provider" | "save";

export interface SavedResponse {
  response_id: string;
  chat_id: string;
  user_id: string;
  message: string;
  response_text: string;
  provider: string;
  request_id: string;
  timestamp: number;
}

export interface ActionLog {
  action_id: string;
  chat_id: string;
  user_id: string;
  account_label: string;
  action_type: ActionType;
  status: "clicked" | "completed" | "failed";
  error?: string;
  timestamp: number;
}

export const ACTION_BUTTONS = [
  { action: "repeat" as ActionType, label_ru: "🔁 Повторить", label_en: "🔁 Repeat" },
  { action: "clarify" as ActionType, label_ru: "✏️ Уточнить", label_en: "✏️ Clarify" },
  { action: "file" as ActionType, label_ru: "📄 В файл", label_en: "📄 Send as file" },
  { action: "read_aloud" as ActionType, label_ru: "🔊 Озвучить", label_en: "🔊 Read aloud" },
  { action: "image" as ActionType, label_ru: "🖼 Картинка", label_en: "🖼 Generate image" },
  { action: "provider" as ActionType, label_ru: "🧠 Провайдер", label_en: "🧠 Switch provider" },
  { action: "save" as ActionType, label_ru: "📌 Сохранить", label_en: "📌 Save" },
];

const SAVED_RESPONSES_FILE = path.join(DATA_DIR, "saved-responses.jsonl");
const ACTION_LOG_FILE = path.join(DATA_DIR, "action-log.jsonl");
const MAX_SAVED_RESPONSES = 1000;

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveResponse(
  chatId: string,
  userId: string,
  message: string,
  responseText: string,
  provider: string,
  requestId: string
): Promise<SavedResponse> {
  await ensureDir();

  const response: SavedResponse = {
    response_id: makeId("resp"),
    chat_id: chatId,
    user_id: userId,
    message,
    response_text: responseText,
    provider,
    request_id: requestId,
    timestamp: Date.now(),
  };

  try {
    const line = JSON.stringify(response) + "\n";
    await fs.appendFile(SAVED_RESPONSES_FILE, line, "utf-8");
  } catch (e) {
    console.error("[action-buttons] save response failed", e);
  }

  return response;
}

export async function getLastResponse(chatId: string, userId: string): Promise<SavedResponse | null> {
  const responses: SavedResponse[] = [];

  try {
    await ensureDir();
    const content = await fs.readFile(SAVED_RESPONSES_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-MAX_SAVED_RESPONSES);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.chat_id === chatId && parsed.user_id === userId) {
          responses.push(parsed);
        }
      } catch {}
    }
  } catch {}

  if (responses.length === 0) return null;

  return responses.sort((a, b) => b.timestamp - a.timestamp)[0];
}

export async function logAction(
  chatId: string,
  userId: string,
  accountLabel: string,
  actionType: ActionType,
  status: ActionLog["status"],
  error?: string
): Promise<void> {
  await ensureDir();

  const log: ActionLog = {
    action_id: makeId("act"),
    chat_id: chatId,
    user_id: userId,
    account_label: accountLabel,
    action_type: actionType,
    status,
    error,
    timestamp: Date.now(),
  };

  try {
    const line = JSON.stringify(log) + "\n";
    await fs.appendFile(ACTION_LOG_FILE, line, "utf-8");
  } catch (e) {
    console.error("[action-buttons] log action failed", e);
  }
}

export function buildActionButtons(lang: Language = "ru"): { text: string; callback_data: string }[] {
  return ACTION_BUTTONS.map((btn) => ({
    text: lang === "ru" ? btn.label_ru : btn.label_en,
    callback_data: `action_${btn.action}`,
  }));
}

export function buildReplyExtra(lang: Language = "ru"): { reply_markup: ReturnType<typeof Markup.inlineKeyboard> } {
  const buttons = buildActionButtons(lang);
  const rows: { text: string; callback_data: string }[][] = [];
  let currentRow: { text: string; callback_data: string }[] = [];

  for (const btn of buttons) {
    currentRow.push(btn);
    if (currentRow.length >= 2) {
      rows.push([...currentRow]);
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return { reply_markup: Markup.inlineKeyboard(rows) };
}

export async function handleActionCallback(
  callbackData: string,
  chatId: string,
  userId: string,
  accountLabel: string,
  lang: Language
): Promise<{ text: string; show_alert?: boolean }> {
  const action = callbackData.replace("action_", "") as ActionType;
  await logAction(chatId, userId, accountLabel, action, "clicked");

  switch (action) {
    case "repeat":
      return { text: lang === "ru" ? "Повторяю..." : "Repeating..." };
    case "clarify":
      return { text: lang === "ru" ? "Уточняю..." : "Clarifying..." };
    case "file":
      return { text: lang === "ru" ? "Отправляю файлом..." : "Sending as file..." };
    case "read_aloud":
      return { text: lang === "ru" ? "Voice Layer скоро!" : "Voice Layer coming soon!", show_alert: true };
    case "image":
      return { text: lang === "ru" ? "Image Layer скоро!" : "Image Layer coming soon!", show_alert: true };
    case "provider":
      return { text: lang === "ru" ? "Откройте меню провайдера" : "Open provider menu", show_alert: true };
    case "save":
      return { text: lang === "ru" ? "Сохранено!" : "Saved!" };
    default:
      return { text: "Unknown action" };
  }
}