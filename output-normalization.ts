/**
 * PACKAGE: TELEGRAM OUTPUT NORMALIZATION
 * 
 * Этот модуль отвечает за преобразование сырых данных из Bridge (например, ChatGPT)
 * в структурированный формат и выбор оптимального способа рендеринга в Telegram.
 */

function debugPreserve(label: string, value: unknown): void {
  if (process.env.DEBUG_BRIDGE_OUTPUT !== "true") return;

  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  console.log(`\n[DEBUG] ${label} START`);
  console.log(text);
  console.log(`[DEBUG] ${label} END\n`);
}

/**
 * Единый контракт ответа (BridgeOutput)
 */
/**
 * Глобальная карта расширений для всех узлов Core
 */
export const LANGUAGE_EXTENSION_MAP: Record<string, string> = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  rust: "rs",
  golang: "go",
  html: "html",
  css: "css",
  markdown: "md",
  json: "json",
  sql: "sql",
  yaml: "yaml",
  bash: "sh",
};

export const SUPPORTED_FILE_EXTENSIONS = [".py", ".md", ".json", ".js", ".ts", ".rs", ".go", ".sql", ".yaml", ".yml", ".sh"];

export type BridgeOutput =
  | { kind: "text"; text: string }
  | { kind: "markdown"; text: string }
  | { kind: "code"; language: string; code: string }
  | { kind: "file"; filename: string; content: string; language?: string };

/**
 * Узел B: Output Classifier
 * Ответственность: Понимает, это текст, markdown, код или файл.
 */
export class OutputClassifier {
  private static readonly CODE_BLOCK_REGEXP = /^```(\w+)?\n([\s\S]*?)\n```$/;
  private static readonly MAX_TELEGRAM_MESSAGE_LENGTH = 4000;

  static classify(content: string, userText?: string): BridgeOutput {
    const trimmed = content.trim();

    debugPreserve("CLASSIFIER_USER_TEXT", userText);
    debugPreserve("CLASSIFIER_CONTENT", content);

    // Anti-stuck fallback: детектируем деградацию контекста
    if (this.detectStuckContext(trimmed)) {
      return {
        kind: "text",
        text: "⚠️ Обнаружен залипший контекст ChatGPT. Выполните /new для создания нового чата."
      };
    }

    // Safety: если текст слишком длинный, сразу отправляем как файл
    if (trimmed.length > this.MAX_TELEGRAM_MESSAGE_LENGTH) {
      return {
        kind: "file",
        filename: "response.txt",
        content: trimmed
      };
    }

    const request = userText?.toLowerCase() || "";

    // 1. Проверка на явный запрос файла пользователем
    const fileKeywords = ["файлом", "файл", ...SUPPORTED_FILE_EXTENSIONS];
    const wantsFile = fileKeywords.some(kw => request.includes(kw));

    // 2. Проверка на чистый блок кода
    const codeMatch = trimmed.match(this.CODE_BLOCK_REGEXP);
    
    if (wantsFile) {
      return {
        kind: "file",
        filename: this.deriveFilename(request, codeMatch?.[1]),
        content: codeMatch ? codeMatch[2].trim() : trimmed
      };
    }

    if (codeMatch) {
      return {
        kind: "code",
        language: codeMatch[1] || "text",
        code: codeMatch[2].trim(),
      };
    }

    // 3. Проверка на наличие смешанного кода (текст + код внутри)
    // Если в ответе есть блоки кода, но это не "чистый код", помечаем как markdown
    if (trimmed.includes("```")) {
      return {
        kind: "markdown",
        text: trimmed,
      };
    }

    // 4. Проверка на наличие базовой разметки Markdown
    const hasMarkdown = /[*_#\[]/.test(trimmed);
    if (hasMarkdown) {
      return { kind: "markdown", text: trimmed };
    }

    // 5. По умолчанию — обычный текст
    return { kind: "text", text: trimmed };
  }

  private static detectStuckContext(text: string): boolean {
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return false;

    const repeats = (trimmed.match(/ты тут\?/g) || []).length;
    if (repeats >= 2) return true;

    if (trimmed.includes("составление текстовты тут?")) return true;

    return false;
  }

  private static deriveFilename(userText: string, detectedLang?: string): string {
    const text = (userText || "").toLowerCase();

    for (const ext of SUPPORTED_FILE_EXTENSIONS) {
      if (text.includes(ext)) return `script${ext}`;
    }
    const ext = LANGUAGE_EXTENSION_MAP[(detectedLang || "").toLowerCase()] || "txt";
    return `result.${ext}`;
  }
}