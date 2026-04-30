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

// v3.2 fast local profile + chunked generation
const DEFAULT_MODEL = process.env.LONGFORM_MODEL ?? "qwen2.5:3b-instruct";
const DEFAULT_TIMEOUT_MS = Number(process.env.LONGFORM_TIMEOUT_MS ?? "120000");
const DEFAULT_NUM_PREDICT = Number(process.env.LONGFORM_NUM_PREDICT ?? "3500");
const DEFAULT_TEMPERATURE = Number(process.env.LONGFORM_TEMPERATURE ?? "0.7");
const DEFAULT_RETRY_TEMPERATURE = Number(process.env.LONGFORM_RETRY_TEMPERATURE ?? "0.85");
const MAX_RETRIES = 1;

// v3.2 chunked generation config
const CHUNK_WORDS = Number(process.env.LONGFORM_CHUNK_WORDS ?? "350");
const CHUNK_TIMEOUT_MS = Number(process.env.LONGFORM_CHUNK_TIMEOUT_MS ?? "90000");
const CHUNK_NUM_PREDICT = 1200;
const CHUNKED_THRESHOLD = 500; // above this, use chunked mode

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

async function callOllama(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  numPredict: number,
  temperature: number,
): Promise<string> {
  const url = `${baseUrl}/api/chat`;
  const body: OllamaChatReq = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
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

  const response = await postJson(url, headers, JSON.stringify(body), timeoutMs);

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Ollama error: ${response.statusCode} - ${response.body.slice(0, 500)}`);
  }

  const json = JSON.parse(response.body);
  const extracted = json.message?.content ?? json.output ?? "";

  if (!extracted || extracted.trim().length === 0) {
    throw new Error("Empty response from Ollama");
  }

  return extracted;
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

// v3.2 section builder
interface ArticleSection {
  heading: string;
  prompt: string;
  isConclusion?: boolean;
}

function detectRegion(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("грузи") || lower.includes("тбилис")) return "Грузия, Тбилиси";
  if (lower.includes("росси") || lower.includes("москв")) return "Россия, Москва";
  if (lower.includes("украин")) return "Украина";
  if (lower.includes("европ")) return "Европа";
  return "";
}

function buildTattooTrendSections(message: string, region: string, chunkCount: number): ArticleSection[] {
  const regionHint = region ? ` (контекст: ${region})` : "";

  const allSections: ArticleSection[] = [
    {
      heading: "Введение",
      prompt: `Напиши введение для статьи о тату трендах. Тема: ${message}. Объём ~${CHUNK_WORDS} слов. Объясни, почему тема актуальна сейчас. Пиши как эксперт.`,
    },
    {
      heading: "Fine line и micro tattoo",
      prompt: `Опиши тренд fine line и micro tattoo в тату${regionHint}. Что это, почему популярен, как проявляется. ~${CHUNK_WORDS} слов.`,
    },
    {
      heading: "Blackwork и графика",
      prompt: `Опиши тренд blackwork и геометрической графики в тату${regionHint}. ~${CHUNK_WORDS} слов.`,
    },
    {
      heading: "Реализм и портретные работы",
      prompt: `Опиши тренд реализма и портретных татуировок${regionHint}. ~${CHUNK_WORDS} слов.`,
    },
    {
      heading: "Этнические мотивы и локальная символика",
      prompt: `Опиши использование этнических мотивов в тату${regionHint}. Реальные паттерны, не выдуманные. ~${CHUNK_WORDS} слов.`,
    },
    {
      heading: "Минимализм и lettering",
      prompt: `Опиши тренд минимализма и lettering в тату${regionHint}. ~${CHUNK_WORDS} слов.`,
    },
    {
      heading: "Что выбирают клиенты",
      prompt: `Опиши реальные запросы и поведение клиентов тату-мастеров${regionHint}. ~${CHUNK_WORDS} слов.`,
    },
    {
      heading: "Как развивается индустрия",
      prompt: `Опиши развитие тату-индустрии: оборудование, техники, стандарты${regionHint}. ~${CHUNK_WORDS} слов.`,
    },
    {
      heading: "Вывод",
      prompt: `Напиши заключение-вывод для статьи о тату трендах. Тема: ${message}. ~${CHUNK_WORDS} слов.`,
      isConclusion: true,
    },
  ];

  // Select sections to match chunkCount: intro + N trends + clients + industry + conclusion
  // Minimum: intro + 3 trends + conclusion = 5 chunks
  const minChunks = 5;
  const maxTrendSections = Math.max(1, chunkCount - minChunks);

  const trendSections = allSections.slice(1, 7); // 6 trend sections
  const selectedTrends = trendSections.slice(0, maxTrendSections);

  return [
    allSections[0], // intro
    ...selectedTrends,
    allSections[7], // clients
    allSections[8], // conclusion
  ].slice(0, chunkCount);
}

function buildGenericSections(message: string, chunkCount: number): ArticleSection[] {
  const sections: ArticleSection[] = [
    {
      heading: "Введение",
      prompt: `Напиши введение для статьи. Тема: ${message}. Объём ~${CHUNK_WORDS} слов. ~${CHUNK_WORDS} слов.`,
    },
  ];

  for (let i = 1; i <= chunkCount - 2; i++) {
    sections.push({
      heading: `Раздел ${i}`,
      prompt: `Напиши раздел ${i} статьи на тему: ${message}. Раскрой конкретные аспекты темы. ~${CHUNK_WORDS} слов. Пиши подробно, без воды.`,
    });
  }

  sections.push({
    heading: "Вывод",
    prompt: `Напиши заключение для статьи. Тема: ${message}. ~${CHUNK_WORDS} слов.`,
    isConclusion: true,
  });

  return sections;
}

function buildSections(message: string, chunkCount: number): ArticleSection[] {
  const lower = message.toLowerCase();
  const isTattoo = lower.includes("тату") || lower.includes("tattoo") || lower.includes("татуировк");
  const region = detectRegion(message);

  if (isTattoo) {
    return buildTattooTrendSections(message, region, chunkCount);
  }
  return buildGenericSections(message, chunkCount);
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

// v3.2 chunked generation
async function generateChunkedLongformText(
  message: string,
  targetWords: number,
  baseUrl: string,
  model: string,
  onProgress?: (text: string) => Promise<void>,
): Promise<string> {
  const chunkCount = Math.ceil(targetWords / CHUNK_WORDS);
  const sections = buildSections(message, chunkCount);

  console.log("[longform] chunked_generation_started", { targetWords, chunkCount, sections: sections.length });

  let finalText = `# ${message}\n\n`;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    console.log("[longform] chunk_started", { index: i + 1, total: sections.length, title: section.heading });

    // Progress: first, middle, last
    if (i === 0 || i === Math.floor(sections.length / 2) || i === sections.length - 1) {
      if (onProgress) {
        await onProgress(`✍️ Пишу часть ${i + 1}/${sections.length}: ${section.heading}`).catch(() => {});
      }
    }

    const sectionText = await callOllama(
      baseUrl,
      model,
      `Ты профессиональный автор. Пиши ТОЛЬКО реальные факты, без выдуманных названий. Пиши живо, как эксперт.`,
      section.prompt,
      CHUNK_TIMEOUT_MS,
      CHUNK_NUM_PREDICT,
      DEFAULT_TEMPERATURE,
    );

    const sectionStats = getTextStats(sectionText);
    if (sectionStats.words < 120) {
      console.log("[longform] chunk_too_short", { index: i + 1, words: sectionStats.words });
    }

    finalText += `## ${section.heading}\n\n${sectionText.trim()}\n\n`;

    console.log("[longform] chunk_completed", {
      index: i + 1,
      total: sections.length,
      words: sectionStats.words,
    });
  }

  const finalStats = getTextStats(finalText);
  console.log("[longform] chunked_generation_completed", {
    totalWords: finalStats.words,
    chunks: sections.length,
  });

  return finalText;
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
    chunkWords: CHUNK_WORDS,
    chunkTimeoutMs: CHUNK_TIMEOUT_MS,
  });

  console.log("[longform] queued", { messageLength: message.length, model, targetWords });

  if (onProgress) {
    await onProgress("⏳ Генерирую большой материал...");
  }

  try {
    let text: string;

    if (targetWords > CHUNKED_THRESHOLD) {
      // v3.2 chunked mode
      text = await generateChunkedLongformText(message, targetWords, baseUrl, model, onProgress);
    } else {
      // Single-shot mode for short articles
      text = await withRetry(
        async (attemptNum = 1) => {
          const temperature = attemptNum === 1 ? DEFAULT_TEMPERATURE : DEFAULT_RETRY_TEMPERATURE;

          const extracted = await callOllama(
            baseUrl,
            model,
            buildLongformSystemPrompt(message, targetWords),
            `Write a comprehensive article about: ${message}`,
            timeoutMs,
            numPredict,
            temperature,
          );

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

          return extracted;
        },
        MAX_RETRIES,
        1500,
      );
    }

    const stats = getTextStats(text);
    const threshold = getWordThreshold(targetWords);

    // For chunked mode, accept if >= threshold
    if (stats.words < targetWords * threshold) {
      console.log("[longform] quality_check_below_threshold", {
        words: stats.words,
        required: Math.floor(targetWords * threshold),
        accepting: targetWords > CHUNKED_THRESHOLD,
      });
      // Accept anyway for chunked mode — it's better than nothing
      if (targetWords <= CHUNKED_THRESHOLD) {
        throw new Error("LONGFORM_TOO_SHORT");
      }
    }

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
