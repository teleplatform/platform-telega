import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type OutputResult } from "./contracts.js";
import { categorizeSize, SIZE_POLICY } from "./size-policy.js";
import { TelegramDeliveryQueue, getDeliveryQueue } from "./delivery-queue.js";

const CHUNK_TARGET = 3000;
const CHUNK_HARD = 3500;

export type OutputKind = "plain_text" | "code" | "mixed";

export type OutputMode =
  | "text"
  | "chunked_text"
  | "code_block"
  | "chunked_code"
  | "file";

export type OutputDecision = {
  kind: OutputKind;
  mode: OutputMode;
  reason:
    | "short_text"
    | "long_text"
    | "short_code"
    | "medium_code"
    | "large_code"
    | "oversized_output";
  fileName?: string;
  detectedLang?: string;
};

const CODE_LANGS = new Set([
  "ts", "typescript",
  "js", "javascript", 
  "json",
  "py", "python",
  "sql",
  "yaml", "yml",
  "bash", "sh",
  "go", "rust", "rs",
  "java", "cpp", "c",
  "html", "css", "xml",
]);

const CODE_SIGNALS = [
  /```/,
  /\bfunction\b/,
  /\bconst\b/,
  /\blet\b/,
  /\bvar\b/,
  /\bclass\b/,
  /\binterface\b/,
  /\btype\b/,
  /\breturn\b/,
  /\{[\s\S]*\}/,
  /=>/,
  /\bimport\b/,
  /\bexport\b/,
];

function detectOutputKind(text: string, detectedLang?: string): OutputKind {
  const lang = (detectedLang || "").toLowerCase();

  if (CODE_LANGS.has(lang)) return "code";

  const score = CODE_SIGNALS.reduce((acc, rx) => acc + (rx.test(text) ? 1 : 0), 0);

  if (score >= 3) return "code";
  if (score >= 1) return "mixed";
  return "plain_text";
}

function normalizeLang(detectedLang?: string): string | undefined {
  const lang = (detectedLang || "").toLowerCase();
  if (!lang) return undefined;
  
  const map: Record<string, string> = {
    typescript: "ts",
    javascript: "js", 
    python: "py",
  };
  
  return map[lang] || lang;
}

function deriveOutputFilename(detectedLang?: string): string {
  const lang = normalizeLang(detectedLang);
  
  const extMap: Record<string, string> = {
    ts: "result.ts",
    js: "result.js",
    py: "result.py",
    json: "result.json",
    sql: "result.sql",
    yaml: "result.yaml",
    yml: "result.yaml",
    md: "result.md",
    sh: "result.sh",
    go: "result.go",
    rs: "result.rs",
  };

  return extMap[lang || ""] || "result.txt";
}

export function decideOutputMode(text: string, detectedLang?: string): OutputDecision {
  const length = text.length;
  const kind = detectOutputKind(text, detectedLang);
  const lang = normalizeLang(detectedLang);

  if (kind === "plain_text") {
    if (length <= 3200) {
      return { kind, mode: "text", reason: "short_text" };
    }
    if (length <= 12000) {
      return { kind, mode: "chunked_text", reason: "long_text" };
    }
    return {
      kind,
      mode: "file",
      reason: "oversized_output",
      fileName: "response.md",
      detectedLang: "md",
    };
  }

  if (kind === "code") {
    if (length <= 1800) {
      return {
        kind,
        mode: "code_block",
        reason: "short_code",
        detectedLang: lang,
      };
    }
    if (length <= 7000) {
      return {
        kind,
        mode: "chunked_code",
        reason: "medium_code",
        detectedLang: lang,
      };
    }
    return {
      kind,
      mode: "file",
      reason: "large_code",
      fileName: deriveOutputFilename(lang),
      detectedLang: lang,
    };
  }

  if (length <= 3000) {
    return { kind, mode: "text", reason: "short_text" };
  }
  if (length <= 9000) {
    return { kind, mode: "chunked_text", reason: "long_text" };
  }
  return {
    kind,
    mode: "file",
    reason: "oversized_output",
    fileName: lang ? deriveOutputFilename(lang) : "response.md",
    detectedLang: lang,
  };
}

function wrapCodeBlock(text: string, detectedLang?: string): string {
  const lang = normalizeLang(detectedLang) || "";
  return `\`\`\`${lang}\n${text.trim()}\n\`\`\``;
}

function splitText(text: string, max: number): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= max) return [trimmed];

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > max) {
    let cut = remaining.lastIndexOf("\n## ", max);
    if (cut < max * 0.4) cut = remaining.lastIndexOf("\n\n", max);
    if (cut < max * 0.4) cut = remaining.lastIndexOf("\n", max);
    if (cut < max * 0.4) cut = remaining.lastIndexOf(" ", max);
    if (cut < max * 0.4) cut = max;

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

async function sendAsFile(
  sendDocFn: (filePath: string, opts?: any) => Promise<any>,
  text: string,
  fileName: string,
  caption?: string
): Promise<number | undefined> {
  const tempPath = path.join(os.tmpdir(), fileName);
  await fs.writeFile(tempPath, text, "utf8");

  try {
    const message = await sendDocFn(tempPath, {
      caption: caption || "📄 Ответ длинный. Отправляю файлом.",
    });
    return message?.message_id;
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

export async function sendSmartOutput(
  text: string,
  sendMessageFn: (text: string, opts?: any) => Promise<any>,
  sendDocumentFn?: (filePath: string, opts?: any) => Promise<any>,
  detectedLang?: string
): Promise<OutputResult> {
  const queue = getDeliveryQueue();
  const decision = decideOutputMode(text, detectedLang);

  switch (decision.mode) {
    case "text":
      await queue.send(0, text);
      return { ok: true, method: "text", content: text };

    case "chunked_text": {
      const chunks = splitText(text, 3200);
      for (let i = 0; i < chunks.length; i++) {
        const prefix = chunks.length > 1 ? `[${i + 1}/${chunks.length}]\n\n` : "";
        await queue.send(0, prefix + chunks[i]);
      }
      return { ok: true, method: "chunked", chunks };
    }

    case "code_block": {
      const formatted = wrapCodeBlock(text, decision.detectedLang);
      await queue.send(0, formatted);
      return { ok: true, method: "text", content: formatted };
    }

    case "chunked_code": {
      const chunks = splitText(text, 2500);
      for (let i = 0; i < chunks.length; i++) {
        const prefix = chunks.length > 1 ? `Часть ${i + 1}/${chunks.length}\n` : "";
        const formatted = wrapCodeBlock(chunks[i], decision.detectedLang);
        await queue.send(0, prefix + formatted);
      }
      return { ok: true, method: "chunked", chunks };
    }

    case "file": {
      const fileName = decision.fileName || deriveOutputFilename(detectedLang);
      
      if (sendDocumentFn) {
        await sendAsFile(sendDocumentFn, text, fileName, "📎 Отправляю файлом.");
      } else {
        await queue.send(0, `📎 Ответ большой (${text.length} символов). Файл: ${fileName}`);
      }
      return { ok: true, method: "file", content: text, fileName };
    }

    default:
      await queue.send(0, text);
      return { ok: true, method: "text", content: text };
  }
}

export function analyzeSmart(text: string, detectedLang?: string): { decision: OutputDecision; isCode: boolean; isLarge: boolean } {
  const decision = decideOutputMode(text, detectedLang);
  const isCode = decision.kind === "code";
  const isLarge = decision.mode === "file" || decision.mode === "chunked_code" || decision.mode === "chunked_text";

  return { decision, isCode, isLarge };
}

export function splitTextSmart(text: string, max = 3200): string[] {
  return splitText(text, max);
}

export function shouldOutputAsFile(text: string, detectedLang?: string): boolean {
  const decision = decideOutputMode(text, detectedLang);
  return decision.mode === "file";
}

export async function sendTelegramOutput(
  text: string,
  sendFn: (text: string, opts?: any) => Promise<any>,
  userText?: string
): Promise<OutputResult> {
  return await sendSmartOutput(text, sendFn, undefined, undefined);
}

// ============================================
// OUTPUT DELIVERY CONTRACT
// Ensures only valid, stable output goes to Telegram
// ============================================

export function normalizeText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isEchoReply(userText: string, assistantText: string): boolean {
  const u = normalizeText(userText).toLowerCase();
  const a = normalizeText(assistantText).toLowerCase();
  if (!u || !a) return false;
  return a === u || (a.startsWith(u) && a.length <= u.length + 16);
}

export function isFallbackDescription(text: string): boolean {
  const t = normalizeText(text).toLowerCase();
  const fallbacks = [
    "tele•gpt — это инструмент",
    "продукт платформы tele•ga",
    "tele·gpt — control surface",
    "telegram bot platform",
    "продукт платформы",
  ];
  return fallbacks.some(f => t.includes(f.toLowerCase()));
}

export function isInvalidAssistantOutput(userText: string, assistantText?: string): boolean {
  const text = normalizeText(assistantText);
  if (!text) return true;
  if (text.length < 5) return true;
  if (isEchoReply(userText, text)) return true;
  if (isFallbackDescription(text)) return true;
  return false;
}

export function prepareUserInput(text: string, maxChars = 12000): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, maxChars) + "\n\n[обрезано для доставки]";
}

export function buildDeliveryFailureText(): string {
  return "⚠️ Сообщение слишком большое или ответ не успел стабильно сформироваться. Попробуй отправить короче.";
}

export async function deliverAssistantToTelegram(
  ctx: any,
  userText: string,
  assistantText: string,
  provider: string,
  transport: string,
  traceId?: string
): Promise<void> {
  const chatId = ctx?.chat?.id || 0;
  const normalized = normalizeText(assistantText);

  // Evidence: Invalid output
  if (isInvalidAssistantOutput(userText, normalized)) {
    console.log("[delivery] blocked invalid output, sending failure text");
    try {
      const { logBlocked } = await import("../runtime/delivery/delivery-evidence.logger.js");
      logBlocked(traceId || "unknown", chatId, provider, transport, userText.length, normalized.length, "invalid_output");
    } catch {}
    await ctx.reply(buildDeliveryFailureText(), { disable_web_page_preview: true });
    return;
  }

  // Chunk for Telegram
  const TELEGRAM_CHUNK_LIMIT = 3500;
  const chunks: string[] = [];
  let remaining = normalized;

  while (remaining.length > TELEGRAM_CHUNK_LIMIT) {
    let splitAt = remaining.lastIndexOf("\n", TELEGRAM_CHUNK_LIMIT);
    if (splitAt < 1000) splitAt = remaining.lastIndexOf(" ", TELEGRAM_CHUNK_LIMIT);
    if (splitAt < 1000) splitAt = TELEGRAM_CHUNK_LIMIT;

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);

  console.log(`[delivery] sending ${chunks.length} chunk(s), provider=${provider}, transport=${transport}`);

  // Evidence: Success
  try {
    const { logSuccess } = await import("../runtime/delivery/delivery-evidence.logger.js");
    logSuccess(traceId || "unknown", chatId, provider, transport, userText.length, normalized.length, chunks.length);
  } catch {}

  for (const chunk of chunks) {
    await ctx.reply(chunk, { disable_web_page_preview: true });
  }
}