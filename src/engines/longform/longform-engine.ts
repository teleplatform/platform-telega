import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";

export interface LongformResult {
  status: "done" | "fallback";
  filePath: string;
  text: string;
  chars: number;
  words: number;
  fallback: boolean;
  model: string;
  latencyMs: number;
  error?: string;
}

interface OllamaChatReq {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
  };
}

// v3.1 fast local profile — configurable via env
const DEFAULT_MODEL = process.env.LONGFORM_MODEL ?? "qwen2.5:3b-instruct";
const DEFAULT_TIMEOUT_MS = Number(process.env.LONGFORM_TIMEOUT_MS ?? "120000");
const DEFAULT_NUM_PREDICT = Number(process.env.LONGFORM_NUM_PREDICT ?? "3500");
const DEFAULT_TEMPERATURE = Number(process.env.LONGFORM_TEMPERATURE ?? "0.7");
const DEFAULT_RETRY_TEMPERATURE = Number(process.env.LONGFORM_RETRY_TEMPERATURE ?? "0.85");
const MAX_RETRIES = 1; // total 2 attempts max

function postJson(
  urlString: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          ...headers,
          "content-length": Buffer.byteLength(body).toString(),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`LONGFORM_TIMEOUT_FAST_AFTER_${timeoutMs}ms`));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  retries = MAX_RETRIES,
  delayMs = 1500,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      if ((err as Error)?.message === "LONGFORM_TOO_SHORT") {
        console.log("[longform] retry_due_to_short_output", { attempt });
      } else {
        console.log("[longform] generation_retry", {
          attempt,
          error: String((err as Error)?.message || err),
        });
      }

      if (attempt <= retries) {
        await new Promise((r) => setTimeout(r, delayMs * attempt));
      }
    }
  }

  throw lastError;
}

function getTextStats(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return {
    chars: text.length,
    words,
  };
}

function extractTargetWords(message: string): number | null {
  const match = message.match(/(\d{3,5})\s*(?:слов|слова|word)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function getWordThreshold(targetWords: number): number {
  return targetWords <= 1000 ? 0.7 : 0.6;
}

function buildLongformSystemPrompt(message: string, targetWords: number): string {
  return [
    "Ты профессиональный автор и эксперт по тату-культуре.",
    "",
    `Задача:\n${message}`,
    "",
    "Требования:",
    "- Пиши ТОЛЬКО реальные тренды, без выдуманных стилей",
    "- Не придумывай названия школ или направлений",
    "- Используй современные реальные направления:",
    "  (fine line, blackwork, realism, micro tattoo, lettering, ethnic, minimalism и т.д.)",
    "- Учитывай регион (Грузия, Тбилиси, локальные студии, культура)",
    "- Пиши живо, как эксперт, а не как учебник",
    "- Избегай воды и повторов",
    "",
    "Структура ОБЯЗАТЕЛЬНА:",
    "",
    "# Заголовок",
    "",
    "## Введение (почему тема актуальна)",
    "",
    "## Основные тренды (минимум 5-7 пунктов)",
    "Каждый тренд:",
    "- что это",
    "- почему популярен",
    "- как проявляется в Грузии",
    "",
    "## Что выбирают клиенты",
    "(реальные запросы, поведение)",
    "",
    "## Работа мастеров",
    "(техника, оборудование, стиль работы)",
    "",
    "## Будущее индустрии",
    "",
    "## Вывод",
    "",
    "Ограничения:",
    `- минимум ${targetWords} слов`,
    `- не меньше ${Math.floor(targetWords * 0.8)} слов (80% от заданного объёма)`,
    "- цельный текст без обрывов",
  ].join("\n");
}

function buildFallbackMarkdown(
  message: string,
  reason: string,
  profile: { model: string; timeoutMs: number; numPredict: number; targetWords: number },
): string {
  const isTimeout = reason.includes("LONGFORM_TIMEOUT") || reason.includes("timed out");

  const reasonText = isTimeout
    ? "Локальная модель не успела сгенерировать материал в заданный лимит."
    : reason;

  return [
    "# Long Form Engine: генерация временно недоступна",
    "",
    "Запрос пользователя:",
    "",
    `> ${message}`,
    "",
    "Причина:",
    `${reasonText}`,
    "",
    "Параметры генерации:",
    `- Модель: ${profile.model}`,
    `- Таймаут: ${profile.timeoutMs}ms`,
    `- Max tokens: ${profile.numPredict}`,
    `- Целевой объём: ${profile.targetWords} слов`,
    "",
    "Проверь команды:",
    "",
    "```bash",
    "ollama list",
    `ollama pull ${profile.model}`,
    "ollama serve",
    "```",
  ].join("\n");
}

function ensureOutputDir(): string {
  const dir = path.join(process.cwd(), "storage", "longform");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function buildProgressText(text: string, stats: { words: number; chars: number }) {
  const preview = text.slice(0, 300);
  return [
    "📄 Материал готов. Формирую файл...",
    "",
    `📊 ${stats.words} слов / ${stats.chars} символов`,
    "Маршрут: Long Form Engine",
    "",
    "Первые строки:",
    preview,
  ].join("\n");
}

function createFallbackFile(
  message: string,
  reason: string,
  profile?: { model: string; timeoutMs: number; numPredict: number; targetWords: number },
): { filePath: string; text: string } {
  const outputDir = ensureOutputDir();
  const fileName = `longform_fallback_${Date.now()}_${randomUUID().slice(0, 8)}.md`;
  const filePath = path.join(outputDir, fileName);
  const defaultProfile = {
    model: DEFAULT_MODEL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    numPredict: DEFAULT_NUM_PREDICT,
    targetWords: 800,
  };
  const text = buildFallbackMarkdown(message, reason, profile ?? defaultProfile);

  fs.writeFileSync(filePath, text, "utf-8");
  console.log("[longform] fallback_file_created", { filePath });

  return { filePath, text };
}

function createSuccessFile(text: string, topic: string, model: string, stats: { words: number; chars: number }): string {
  const outputDir = ensureOutputDir();
  const fileName = `longform_${Date.now()}_${randomUUID().slice(0, 8)}.md`;
  const filePath = path.join(outputDir, fileName);

  const frontmatter = [
    "---",
    `title: "${topic.replace(/"/g, '\\"')}"`,
    `generated: ${new Date().toISOString()}`,
    `model: ${model}`,
    `word_count: ${stats.words}`,
    `char_count: ${stats.chars}`,
    "---",
    "",
  ].join("\n");

  fs.writeFileSync(filePath, frontmatter + text, "utf-8");
  console.log("[longform] file_created", { filePath, words: stats.words, chars: stats.chars });

  return filePath;
}

export async function generateLongformFile(params: {
  message: string;
  chatId?: number | string;
  onProgress?: (text: string) => Promise<void>;
}): Promise<LongformResult> {
  const t0 = Date.now();
  const { message, onProgress } = params;

  const model = DEFAULT_MODEL;
  const timeoutMs = DEFAULT_TIMEOUT_MS;
  const numPredict = DEFAULT_NUM_PREDICT;
  const baseUrl = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");

  const targetWords = extractTargetWords(message) || 800;

  console.log("[longform] model_profile", {
    model,
    timeoutMs,
    numPredict,
    temperature: DEFAULT_TEMPERATURE,
  });

  console.log("[longform] queued", { messageLength: message.length, model, targetWords });

  if (onProgress) {
    await onProgress("⏳ Генерирую большой материал...");
  }

  try {
    const text = await withRetry(
      async (attemptNum = 1) => {
        const url = `${baseUrl}/api/chat`;
        const temperature = attemptNum === 1 ? DEFAULT_TEMPERATURE : DEFAULT_RETRY_TEMPERATURE;

        const body: OllamaChatReq = {
          model,
          messages: [
            { role: "system", content: buildLongformSystemPrompt(message, targetWords) },
            { role: "user", content: `Write a comprehensive article about: ${message}` },
          ],
          stream: false,
          options: {
            temperature,
            num_predict: numPredict,
            top_p: 0.9,
          },
        };

        const headers: Record<string, string> = {
          "content-type": "application/json",
        };

        console.log("[longform] generation_started", { model, url, attempt: attemptNum, temperature, numPredict });

        const response = await postJson(url, headers, JSON.stringify(body), timeoutMs);

        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(`Ollama error: ${response.statusCode} - ${response.body.slice(0, 500)}`);
        }

        const json = JSON.parse(response.body);
        const extracted = json.message?.content ?? json.output ?? "";

        if (!extracted || extracted.trim().length === 0) {
          throw new Error("Empty response from Ollama");
        }

        const stats = getTextStats(extracted);
        const threshold = getWordThreshold(targetWords);

        if (stats.words < targetWords * threshold) {
          console.log("[longform] quality_check_failed", {
            words: stats.words,
            required: Math.floor(targetWords * threshold),
            attempt: attemptNum,
            threshold,
          });
          throw new Error("LONGFORM_TOO_SHORT");
        }

        console.log("[longform] generation_completed", { words: stats.words, chars: stats.chars });

        return extracted;
      },
      MAX_RETRIES,
      1500,
    );

    const stats = getTextStats(text);
    const progressText = buildProgressText(text, stats);

    if (onProgress) {
      await onProgress(progressText);
      await onProgress("📤 Отправляю файл...");
    }

    const filePath = createSuccessFile(text, message, model, stats);

    console.log("[longform] completed", { filePath, words: stats.words, chars: stats.chars, latencyMs: Date.now() - t0 });

    return {
      status: "done",
      filePath,
      text,
      chars: stats.chars,
      words: stats.words,
      fallback: false,
      model,
      latencyMs: Date.now() - t0,
    };
  } catch (e: any) {
    const errorMessage = e?.message || "Unknown error";

    console.log("[longform] generation_failed", { error: errorMessage, latencyMs: Date.now() - t0 });

    const fallback = createFallbackFile(message, errorMessage, {
      model,
      timeoutMs,
      numPredict,
      targetWords,
    });
    const stats = getTextStats(fallback.text);

    if (onProgress) {
      await onProgress(`⚠️ Генерация не удалась: ${errorMessage}\n📄 Создан fallback файл.`);
    }

    return {
      status: "fallback",
      filePath: fallback.filePath,
      text: fallback.text,
      chars: stats.chars,
      words: stats.words,
      fallback: true,
      model,
      latencyMs: Date.now() - t0,
      error: errorMessage,
    };
  }
}

export async function generateLongformFallbackFile(params: {
  message: string;
  error: string;
}): Promise<{ filePath: string; text: string }> {
  const fallback = createFallbackFile(params.message, params.error);
  return { filePath: fallback.filePath, text: fallback.text };
}
