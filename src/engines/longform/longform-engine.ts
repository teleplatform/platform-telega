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

// v3.3 fast local profile + chunked generation + anti-hallucination
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

// v3.3+v3.5 anti-hallucination + claim safety
const FORBIDDEN_PATTERNS = [
  "плазменные пушки",
  "биозиготы",
  "ультразвуковой прицел",
  "хригит",
  "sent-lorenz",
  "norwegian style",
  "норвежский стиль",
  "сан-лоренц",
  "хригитская",
  "плазменн",
  "биоимплант",
  "нейро-чернила",
  "квантов",
  "электронные импланты",
  "тату-код",
  "ультразвуковое сканирование",
  "цифровые плазменные",
  "врачи проводят",
  "официальные стандарты",
  "обязательная сертификация",
  "санитария на высшем уровне",
  "3d-модели имплантов",
  "低调",
  "微",
];

const ALLOWED_LATIN_TERMS = [
  "fine line",
  "blackwork",
  "realism",
  "micro tattoo",
  "lettering",
  "minimalism",
  "traditional",
  "neo-traditional",
  "dotwork",
  "old school",
  "new school",
  "watercolor",
  "ornamental",
  "irezumi",
];

const RISKY_SECTION_TITLES: Record<string, string> = {
  "стандарты безопасности при выполнении татуировок": "Как выбрать безопасную студию",
  "современные технологии в тату-индустрии": "Современный подход мастеров",
  "медицинские аспекты тату": "Что важно знать перед татуировкой",
  "законодательство о татуировках": "Правовые аспекты тату-индустрии",
  "официальные требования к мастерам": "Квалификация и опыт мастеров",
};

function checkForbiddenWords(text: string): string | null {
  const lower = text.toLowerCase();
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }
  return null;
}

function validateRussianOnly(text: string): void {
  const cjkPattern = /[\u3400-\u9FFF\uF900-\uFAFF]/;
  if (cjkPattern.test(text)) {
    console.log("[longform] language_mix_detected", { type: "cjk_characters" });
    throw new Error("LONGFORM_LANGUAGE_MIX_DETECTED");
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return;

  let latinWordCount = 0;
  const latinWordPattern = /^[a-zA-Z][a-zA-Z'-]*$/;

  for (const word of words) {
    if (latinWordPattern.test(word)) {
      const lowerWord = word.toLowerCase().replace(/[.,;:!?()"'-]/g, "");
      const isAllowed = ALLOWED_LATIN_TERMS.some(
        (term) => lowerWord === term.toLowerCase() || term.toLowerCase().includes(lowerWord)
      );
      if (!isAllowed) {
        latinWordCount++;
      }
    }
  }

  const latinRatio = latinWordCount / words.length;
  if (latinRatio > 0.08) {
    console.log("[longform] language_mix_detected", {
      type: "excessive_latin",
      ratio: Math.round(latinRatio * 100) + "%",
      threshold: "8%",
    });
    throw new Error("LONGFORM_LANGUAGE_MIX_DETECTED");
  }
}

function sanitizeSectionTitle(title: string): string {
  const lower = title.toLowerCase().trim();
  for (const [risky, safe] of Object.entries(RISKY_SECTION_TITLES)) {
    if (lower.includes(risky)) {
      console.log("[longform] risky_title_replaced", { from: title, to: safe });
      return safe;
    }
  }
  return title;
}

function countSections(text: string): number {
  const matches = text.match(/^#{1,3}\s/gm);
  return matches ? matches.length : 0;
}

function buildTitle(message: string): string {
  return message
    .replace(/^напиши статью на \d+ слов про /i, "")
    .replace(/^напиши статью про /i, "")
    .replace(/^write an article about /i, "")
    .replace(/^статья на тему /i, "")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

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
      } else if ((err as Error)?.message === "LONGFORM_HALLUCINATION_DETECTED") {
        console.log("[longform] retry_due_to_hallucination", { attempt });
      } else if ((err as Error)?.message === "LONGFORM_LANGUAGE_MIX_DETECTED") {
        console.log("[longform] retry_due_to_language_mix", { attempt });
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

// v3.4 outline-first generation
async function generateOutline(
  baseUrl: string,
  model: string,
  message: string,
  targetWords: number,
): Promise<string[]> {
  const outlinePrompt = [
    `Составь план статьи (ТОЛЬКО список разделов, без текста):`,
    "",
    `Тема: ${message}`,
    `Целевой объём: ${targetWords} слов`,
    "",
    "Требования:",
    "- 6–9 разделов",
    "- реальные темы тату-индустрии",
    "- без выдумок",
    "- короткие названия",
    "",
    "Формат:",
    "1. Введение",
    "2. ...",
    "3. ...",
  ].join("\n");

  const outlineText = await callOllama(
    baseUrl,
    model,
    "Ты профессиональный редактор. Составляй чёткие планы статей.",
    outlinePrompt,
    30000,
    400,
    0.5,
  );

  const sections = outlineText
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 0 && !line.toLowerCase().includes("план") && !line.toLowerCase().startsWith("#"))
    .slice(0, 9);

  if (sections.length < 4) {
    throw new Error("Outline too short: " + sections.length);
  }

  console.log("[longform] outline_generated", { sections: sections.length, items: sections });

  return sections;
}

function buildSectionPromptFromOutline(
  message: string,
  sectionTitle: string,
  sectionIndex: number,
  totalSections: number,
  regionHint: string,
): string {
  const isTrendSection = /тренд|направлен|стиль|популярн/i.test(sectionTitle);
  const isFirst = sectionIndex === 0;
  const isLast = sectionIndex === totalSections - 1;

  let extraInstructions = "";

  if (isTrendSection) {
    extraInstructions = `\nОпиши минимум 5 реальных направлений: fine line, blackwork, realism, minimalism, lettering, dotwork, traditional.`;
  }

  if (isFirst) {
    return [
      `Напиши введение для статьи. Тема: ${message}${regionHint}.`,
      `Объём ~${CHUNK_WORDS} слов. Объясни, почему тема актуальна сейчас. Пиши как эксперт.`,
      extraInstructions,
    ].filter(Boolean).join("\n");
  }

  if (isLast) {
    return [
      `Напиши заключение-вывод для раздела "${sectionTitle}". Тема: ${message}.`,
      `Объём ~${CHUNK_WORDS} слов. Подведи итоги статьи.`,
    ].join("\n");
  }

  return [
    `Напиши ТОЛЬКО раздел "${sectionTitle}" статьи на тему: ${message}${regionHint}.`,
    "Не пиши всю статью.",
    "Не делай вывод, если это не последний раздел.",
    `Объём ~${CHUNK_WORDS} слов. Пиши подробно, без воды.`,
    extraInstructions,
  ].filter(Boolean).join("\n");
}

function buildSectionsFromOutline(
  outline: string[],
  message: string,
  region: string,
): ArticleSection[] {
  const regionHint = region ? ` (контекст: ${region})` : "";
  const total = outline.length;

  return outline.map((title, i) => {
    const safeTitle = sanitizeSectionTitle(title);
    return {
      heading: safeTitle,
      prompt: buildSectionPromptFromOutline(message, safeTitle, i, total, regionHint),
      isConclusion: i === total - 1,
    };
  });
}

function mergeAndCleanArticle(title: string, chunks: Array<{ heading: string; text: string }>): string {
  let result = `# ${title}\n\n`;

  let hasIntro = false;

  for (const chunk of chunks) {
    let text = chunk.text.trim();

    // Remove repeated H1 from chunks
    text = text.replace(/^#\s+.+$/m, "").trim();

    // Remove duplicate intro if already written
    if (hasIntro && /введение|introduction/i.test(chunk.heading)) {
      continue;
    }
    if (/введение/i.test(chunk.heading)) {
      hasIntro = true;
    }

    // Ensure no double ##
    text = text.replace(/^##\s+/m, "");

    result += `## ${chunk.heading}\n\n${text}\n\n`;
  }

  // Fix excessive newlines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim() + "\n";
}

function detectRegion(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("грузи") || lower.includes("тбилис")) return "Грузия, Тбилиси";
  if (lower.includes("росси") || lower.includes("москв")) return "Россия, Москва";
  if (lower.includes("украин")) return "Украина";
  if (lower.includes("европ")) return "Европа";
  return "";
}

const ANTI_HALLUCINATION_SYSTEM_PROMPT = [
  "Ты профессиональный автор и эксперт по тату-культуре.",
  "Пиши ТОЛЬКО реальные факты и реальные стили татуировок.",
  "",
  "Разрешённые реальные стили:",
  "- fine line",
  "- blackwork",
  "- realism (реализм)",
  "- micro tattoo",
  "- lettering",
  "- minimalism (минимализм)",
  "- traditional / neo-traditional",
  "- dotwork (дотворк)",
  "- акварель (watercolor)",
  "- графика / геометрия",
  "- ornamental (орнаментал)",
  "- портретные работы",
  "",
  "Запрещено:",
  "- выдуманные стили",
  "- несуществующее оборудование",
  "- фантастические технологии",
  "- вымышленные названия школ или направлений",
  "",
  "Пиши живо, как эксперт, а не как учебник.",
  "",
  "Не утверждай неподтверждённые факты о законах, официальной сертификации, медицинских процедурах или статистике.",
  "Если нет точных данных — пиши осторожно: 'в профессиональных студиях обычно...', 'важно проверять...', 'клиенту стоит уточнить...'.",
].join("\n");

function buildTattooTrendSections(message: string, region: string, chunkCount: number): ArticleSection[] {
  const regionHint = region ? ` (контекст: ${region})` : "";

  const allSections: ArticleSection[] = [
    {
      heading: "Введение",
      prompt: `Напиши введение для статьи о тату трендах. Тема: ${message}. Объём ~${CHUNK_WORDS} слов. Объясни, почему тема актуальна сейчас. Пиши как эксперт.`,
    },
    {
      heading: "Fine line и micro tattoo",
      prompt: `Опиши тренд fine line и micro tattoo в тату${regionHint}. Что это, почему популярен, как проявляется. ~${CHUNK_WORDS} слов. Пиши ТОЛЬКО реальные факты.`,
    },
    {
      heading: "Blackwork и графика",
      prompt: `Опиши тренд blackwork и геометрической графики в тату${regionHint}. ~${CHUNK_WORDS} слов. Пиши ТОЛЬКО реальные факты.`,
    },
    {
      heading: "Реализм и портретные работы",
      prompt: `Опиши тренд реализма и портретных татуировок${regionHint}. ~${CHUNK_WORDS} слов. Пиши ТОЛЬКО реальные факты.`,
    },
    {
      heading: "Этнические мотивы и локальная символика",
      prompt: `Опиши использование этнических мотивов в тату${regionHint}. Реальные паттерны, не выдуманные. ~${CHUNK_WORDS} слов.`,
    },
    {
      heading: "Минимализм и lettering",
      prompt: `Опиши тренд минимализма и lettering в тату${regionHint}. ~${CHUNK_WORDS} слов. Пиши ТОЛЬКО реальные факты.`,
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

  const minChunks = 5;
  const maxTrendSections = Math.max(1, chunkCount - minChunks);

  const trendSections = allSections.slice(1, 7);
  const selectedTrends = trendSections.slice(0, maxTrendSections);

  return [
    allSections[0],
    ...selectedTrends,
    allSections[7],
    allSections[8],
  ].slice(0, chunkCount);
}

function buildGenericSections(message: string, chunkCount: number): ArticleSection[] {
  const sections: ArticleSection[] = [
    {
      heading: "Введение",
      prompt: `Напиши введение для статьи. Тема: ${message}. Объём ~${CHUNK_WORDS} слов.`,
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
    ANTI_HALLUCINATION_SYSTEM_PROMPT,
    "",
    `Задача:\n${message}`,
    "",
    "Структура ОБЯЗАТЕЛЬНА:",
    "",
    `# ${buildTitle(message)}`,
    "",
    "## Введение (почему тема актуальна)",
    "",
    "## Основные тренды (минимум 5-7 пунктов)",
    "Каждый тренд:",
    "- что это",
    "- почему популярен",
    "- как проявляется",
    "",
    "## Что выбирают клиенты",
    "",
    "## Работа мастеров",
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
  const isHallucination = reason.includes("LONGFORM_HALLUCINATION");
  const isLanguageMix = reason.includes("LONGFORM_LANGUAGE_MIX");

  let reasonText = reason;
  if (isTimeout) {
    reasonText = "Локальная модель не успела сгенерировать материал в заданный лимит.";
  } else if (isHallucination) {
    reasonText = "Генерация остановлена: обнаружены выдуманные факты или несуществующие стили.";
  } else if (isLanguageMix) {
    reasonText = "Генерация остановлена: обнаружены фрагменты на других языках или недопустимые термины.";
  }

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

  const title = buildTitle(topic);

  const frontmatter = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
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

// v3.4 chunked generation with outline-first + anti-hallucination
async function generateChunkedLongformText(
  message: string,
  targetWords: number,
  baseUrl: string,
  model: string,
  onProgress?: (text: string) => Promise<void>,
): Promise<string> {
  const title = buildTitle(message);
  const region = detectRegion(message);

  // Step 1: generate outline
  const outline = await generateOutline(baseUrl, model, message, targetWords);

  // Step 2: build sections from outline
  const sections = buildSectionsFromOutline(outline, message, region);

  console.log("[longform] outline_used", { sections: sections.length, outline });

  // Step 3: generate each section
  const chunks: Array<{ heading: string; text: string }> = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    console.log("[longform] section_generated", { index: i + 1, total: sections.length, title: section.heading });

    if (i === 0 || i === Math.floor(sections.length / 2) || i === sections.length - 1) {
      if (onProgress) {
        await onProgress(`✍️ Пишу часть ${i + 1}/${sections.length}: ${section.heading}`).catch(() => {});
      }
    }

    const sectionText = await withRetry(
      async (attemptNum) => {
        const temp = attemptNum === 1 ? DEFAULT_TEMPERATURE : DEFAULT_RETRY_TEMPERATURE;
        const isRetry = attemptNum > 1;

        const prompt = isRetry
          ? `${section.prompt}\n\n⚠️ Перепиши раздел на чистом русском языке. Без китайских/английских фраз, кроме названий стилей. Без выдуманных технологий. Не утверждай неподтверждённые факты о законах, сертификации или медицине.`
          : section.prompt;

        const text = await callOllama(
          baseUrl,
          model,
          ANTI_HALLUCINATION_SYSTEM_PROMPT,
          prompt,
          CHUNK_TIMEOUT_MS,
          CHUNK_NUM_PREDICT,
          temp,
        );

        const forbidden = checkForbiddenWords(text);
        if (forbidden) {
          console.log("[longform] forbidden_detected", { pattern: forbidden, chunk: i + 1 });
          throw new Error("LONGFORM_HALLUCINATION_DETECTED");
        }

        validateRussianOnly(text);

        const stats = getTextStats(text);
        if (stats.words < 120) {
          console.log("[longform] chunk_too_short", { index: i + 1, words: stats.words });
        }

        return text;
      },
      1,
      1500,
    );

    chunks.push({ heading: section.heading, text: sectionText.trim() });

    console.log("[longform] chunk_completed", {
      index: i + 1,
      total: sections.length,
      words: getTextStats(sectionText).words,
    });
  }

  // Step 4: merge and clean
  const finalText = mergeAndCleanArticle(title, chunks);

  const sectionCount = countSections(finalText);
  if (sectionCount < 4) {
    console.log("[longform] structure_invalid", { sectionCount, required: 4 });
    throw new Error("LONGFORM_TOO_FEW_SECTIONS");
  }

  const finalStats = getTextStats(finalText);
  console.log("[longform] chunked_generation_completed", {
    totalWords: finalStats.words,
    chunks: sections.length,
    sections: sectionCount,
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
      text = await generateChunkedLongformText(message, targetWords, baseUrl, model, onProgress);
    } else {
      text = await withRetry(
        async (attemptNum = 1) => {
          const temperature = attemptNum === 1 ? DEFAULT_TEMPERATURE : DEFAULT_RETRY_TEMPERATURE;

          const extracted = await callOllama(
            baseUrl,
            model,
            ANTI_HALLUCINATION_SYSTEM_PROMPT,
            buildLongformSystemPrompt(message, targetWords),
            timeoutMs,
            numPredict,
            temperature,
          );

          const forbidden = checkForbiddenWords(extracted);
          if (forbidden) {
            console.log("[longform] forbidden_detected", { pattern: forbidden });
            throw new Error("LONGFORM_HALLUCINATION_DETECTED");
          }

          validateRussianOnly(extracted);

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

          const sectionCount = countSections(extracted);
          if (sectionCount < 4) {
            console.log("[longform] structure_invalid", { sectionCount, required: 4 });
            throw new Error("LONGFORM_TOO_FEW_SECTIONS");
          }

          return extracted;
        },
        MAX_RETRIES,
        1500,
      );

      const title = buildTitle(message);
      if (!text.startsWith("# ")) {
        text = `# ${title}\n\n${text}`;
      }
    }

    const stats = getTextStats(text);
    const threshold = getWordThreshold(targetWords);

    if (stats.words < targetWords * threshold) {
      console.log("[longform] quality_check_below_threshold", {
        words: stats.words,
        required: Math.floor(targetWords * threshold),
        accepting: targetWords > CHUNKED_THRESHOLD,
      });
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
