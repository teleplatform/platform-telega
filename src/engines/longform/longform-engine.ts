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

const LONGFORM_TIMEOUT_MS = 8 * 60 * 1000;
const MIN_REASONABLE_WORDS = 50;

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
      req.destroy(new Error(`Longform request timed out after ${timeoutMs}ms`));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 1500,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      console.log("[longform] generation_retry", {
        attempt,
        error: String((err as Error)?.message || err),
      });

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

function buildLongformSystemPrompt(topic: string): string {
  return [
    "You are an expert long-form content writer.",
    "Write a comprehensive, detailed, well-structured article on the given topic.",
    "Use markdown formatting with headings, subheadings, lists, and paragraphs.",
    "Include an introduction, multiple body sections, and a conclusion.",
    "Write at least 2000 words. Be thorough and informative.",
    "Do not include any preamble about what you will write - start the article directly.",
    "Do not mention AI or language models.",
    `Topic: ${topic}`,
  ].join("\n\n");
}

function buildFallbackMarkdown(message: string, reason: string): string {
  return [
    "# Long Form Engine: генерация временно недоступна",
    "",
    "Запрос пользователя:",
    "",
    `> ${message}`,
    "",
    "Причина:",
    `${reason}`,
    "",
    "Проверь команды:",
    "",
    "```bash",
    "ollama list",
    "ollama pull qwen2.5:7b-instruct",
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

function createFallbackFile(message: string, reason: string): { filePath: string; text: string } {
  const outputDir = ensureOutputDir();
  const fileName = `longform_fallback_${Date.now()}_${randomUUID().slice(0, 8)}.md`;
  const filePath = path.join(outputDir, fileName);
  const text = buildFallbackMarkdown(message, reason);

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

  const model = process.env.LONGFORM_MODEL || "qwen2.5:7b-instruct";
  const baseUrl = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");

  console.log("[longform] queued", { messageLength: message.length, model });

  if (onProgress) {
    await onProgress("⏳ Генерирую большой материал...");
  }

  try {
    const text = await withRetry(
      async () => {
        const url = `${baseUrl}/api/chat`;
        const body: OllamaChatReq = {
          model,
          messages: [
            { role: "system", content: buildLongformSystemPrompt(message) },
            { role: "user", content: `Write a comprehensive article about: ${message}` },
          ],
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 16384,
            top_p: 0.9,
          },
        };

        const headers: Record<string, string> = {
          "content-type": "application/json",
        };

        console.log("[longform] generation_started", { model, url });

        const response = await postJson(url, headers, JSON.stringify(body), LONGFORM_TIMEOUT_MS);

        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(`Ollama error: ${response.statusCode} - ${response.body.slice(0, 500)}`);
        }

        const json = JSON.parse(response.body);
        const extracted = json.message?.content ?? json.output ?? "";

        if (!extracted || extracted.trim().length === 0) {
          throw new Error("Empty response from Ollama");
        }

        const stats = getTextStats(extracted);

        if (stats.words < MIN_REASONABLE_WORDS) {
          throw new Error(`Response too short: ${stats.words} words (minimum ${MIN_REASONABLE_WORDS})`);
        }

        console.log("[longform] generation_completed", { words: stats.words, chars: stats.chars });

        return extracted;
      },
      2,
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

    const fallback = createFallbackFile(message, errorMessage);
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
