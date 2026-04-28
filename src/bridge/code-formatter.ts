export type CodeBlock = {
  language?: string;
  content: string;
  startLine: number;
  endLine: number;
};

export type ContentType = 
  | "plain_text"
  | "markdown"
  | "code_only"
  | "mixed_text_code"
  | "json"
  | "yaml"
  | "diff_patch";

export interface CodeAnalysis {
  type: ContentType;
  codeBlocks: CodeBlock[];
  hasCodeBlocks: boolean;
  codeBlockCount: number;
  totalCodeChars: number;
  estimatedLanguage?: string;
}

const CODE_INDICATORS = [
  { pattern: /^```(\w*)\n/, type: "markdown_code" },
  { pattern: /^`{3}(\w*)/, type: "markdown_code" },
  { pattern: /^(const|let|var|function|class|import|export)\s/m, type: "javascript" },
  { pattern: /^(def|class|import|from|if __name__)/m, type: "python" },
  { pattern: /^(interface|type|enum|import\s+.*\s+from)/m, type: "typescript" },
  { pattern: /^(SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE)/im, type: "sql" },
  { pattern: /^\+\+\+|---|^@@.*^@@/m, type: "diff_patch" },
  { pattern: /^\{[\s\S]*\}$/s, type: "json" },
  { pattern: /^\w+:\s*[\w\-]+$/m, type: "yaml" },
];

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  sql: "sql",
  json: "json",
  yaml: "yml",
  markdown: "md",
  diff_patch: "patch",
  html: "html",
  css: "css",
  shell: "sh",
  bash: "sh",
};

const CODE_BLOCK_REGEX = /```(\w*)\n?([\s\S]*?)```/g;
const INLINE_CODE_REGEX = /`([^`]+)`/g;

export function detectCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let match;
  const regex = new RegExp(CODE_BLOCK_REGEX.source, "g");

  let lastIndex = 0;
  let lineNumber = 1;

  while ((match = regex.exec(text)) !== null) {
    const linesSinceLast = text.slice(lastIndex, match.index).split("\n").length - 1;
    lineNumber += linesSinceLast;

    blocks.push({
      language: match[1] || undefined,
      content: match[2] || "",
      startLine: lineNumber,
      endLine: lineNumber + (match[2] || "").split("\n").length - 1,
    });

    lastIndex = match.index + match[0].length;
    lineNumber += (match[2] || "").split("\n").length;
  }

  return blocks;
}

export function analyzeContent(text: string): CodeAnalysis {
  const codeBlocks = detectCodeBlocks(text);
  const hasCodeBlocks = codeBlocks.length > 0;
  const codeBlockCount = codeBlocks.length;
  const totalCodeChars = codeBlocks.reduce((sum, b) => sum + b.content.length, 0);

  let type: ContentType = "plain_text";
  let estimatedLanguage: string | undefined;

  if (text.startsWith("```") || text.includes("```")) {
    type = hasCodeBlocks && text.replace(/```[\s\S]*?```/g, "").trim().length < 200 
      ? "code_only" 
      : "mixed_text_code";
  } else if (hasCodeBlocks) {
    type = "mixed_text_code";
  } else if (text.includes("diff") || text.includes("@@") || text.match(/^[\+\-]{3}.*/m)) {
    type = "diff_patch";
  } else if ((text.trim().startsWith("{") && text.trim().endsWith("}")) || 
             (text.trim().startsWith("[") && text.trim().endsWith("]"))) {
    type = "json";
  } else if (text.match(/^\w+:\s*[\w\-]+$/m)) {
    type = "yaml";
  } else if (text.includes("## ") || text.includes("**")) {
    type = "markdown";
  }

  if (hasCodeBlocks && codeBlocks[0]?.language) {
    estimatedLanguage = codeBlocks[0].language;
  } else if (type === "code_only" || type === "mixed_text_code") {
    for (const indicator of CODE_INDICATORS) {
      if (indicator.pattern.test(text)) {
        estimatedLanguage = indicator.type;
        break;
      }
    }
  }

  return {
    type,
    codeBlocks,
    hasCodeBlocks,
    codeBlockCount,
    totalCodeChars,
    estimatedLanguage,
  };
}

export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCodeForHtml(code: string, language?: string): string {
  const escaped = escapeTelegramHtml(code);
  return `<pre><code class="language-${language || "text"}">${escaped}</code></pre>`;
}

export function formatTelegramOutput(
  text: string,
  analysis?: CodeAnalysis
): { text: string; parseMode: "Markdown" | "HTML" | "Text" } {
  const resolved = analysis || analyzeContent(text);

  if (!resolved.hasCodeBlocks) {
    return {
      text,
      parseMode: "Markdown",
    };
  }

  if (resolved.type === "code_only" && resolved.codeBlockCount === 1) {
    const block = resolved.codeBlocks[0];
    return {
      text: formatCodeForHtml(block.content, block.language),
      parseMode: "HTML",
    };
  }

  if (resolved.totalCodeChars > 500 || resolved.codeBlockCount > 2) {
    return {
      text,
      parseMode: "Markdown",
    };
  }

  let result = text;
  for (const block of resolved.codeBlocks) {
    const formatted = formatCodeForHtml(block.content, block.language);
    result = result.replace(/```[\s\S]*?```/, formatted);
  }

  return {
    text: result,
    parseMode: "HTML",
  };
}

export function deriveOutputFilename(
  text: string,
  analysis?: CodeAnalysis
): string {
  const resolved = analysis || analyzeContent(text);
  
  if (resolved.estimatedLanguage && LANGUAGE_EXTENSIONS[resolved.estimatedLanguage]) {
    return `result.${LANGUAGE_EXTENSIONS[resolved.estimatedLanguage]}`;
  }

  if (hasCodeBlockLanguage(resolved.codeBlocks)) {
    const lang = resolved.codeBlocks.find(b => b.language)?.language;
    if (lang && LANGUAGE_EXTENSIONS[lang]) {
      return `result.${LANGUAGE_EXTENSIONS[lang]}`;
    }
  }

  if (resolved.type === "json") return "result.json";
  if (resolved.type === "yaml") return "result.yml";
  if (resolved.type === "diff_patch") return "result.patch";

  return "result.txt";
}

function hasCodeBlockLanguage(blocks: CodeBlock[]): boolean {
  return blocks.some(b => b.language && LANGUAGE_EXTENSIONS[b.language]);
}

export function shouldCodeGoAsFile(text: string): boolean {
  const analysis = analyzeContent(text);
  
  if (analysis.totalCodeChars > 2000) return true;
  if (analysis.codeBlockCount > 3) return true;
  if (analysis.type === "diff_patch") return true;

  return false;
}

export async function sendCodeOutput(
  text: string,
  sendFn: (text: string, options?: any) => Promise<any>,
  analysis?: CodeAnalysis
): Promise<{ ok: boolean; method: "text" | "html" | "file"; error?: string }> {
  const resolved = analysis || analyzeContent(text);

  if (shouldCodeGoAsFile(text)) {
    return { ok: true, method: "file" };
  }

  if (resolved.type === "code_only" && resolved.codeBlockCount === 1) {
    const formatted = formatTelegramOutput(text, resolved);
    await sendFn(formatted.text, { parse_mode: "HTML" });
    return { ok: true, method: "html" };
  }

  if (resolved.hasCodeBlocks) {
    const formatted = formatTelegramOutput(text, resolved);
    await sendFn(formatted.text, { parse_mode: "HTML" });
    return { ok: true, method: "html" };
  }

  await sendFn(text);
  return { ok: true, method: "text" };
}