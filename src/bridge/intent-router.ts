export type RequestType =
  | "plain_text"
  | "code_request"
  | "large_code_request"
  | "test_scenario";

export type RequestInterpretation = {
  type: RequestType;
  normalizedPrompt: string;
  detectedLang?: string;
  forceFile: boolean;
};

const CODE_SIGNALS = [
  "напиши код",
  "сделай код",
  "функц",
  "function",
  "const ",
  "class ",
  "interface ",
  "type ",
  "return ",
  "typescript",
  "javascript",
  "python",
  "typescript",
  "sql",
  "json",
  "yaml",
  "export ",
  "import ",
  "=>",
];

const LARGE_CODE_SIGNALS = [
  /\b10\s+функц/i,
  /\b20\s+функц/i,
  /\bмного\s+кода/i,
  /\bнесколько\s+функц/i,
  /\bполный\s+файл/i,
  /\bполный\s+модуль/i,
  /\bбольшой\s+код/i,
  /\bразбей\s+на\s+классы/i,
  /\bсделай\s+сразу\s+весь\b/i,
  /\bнапиши\s+полную/i,
  /\.ts\b.*\.tsx/i,
  /\bentire\b.*\bmodule\b/i,
  /10.*function/,
  /20.*function/,
  /создай\s+полноценн/i,
];

const TEST_SCENARIO_MARKERS = [
  "— простой текст",
  "— с кодом",
  "— файл",
  "→",
  "должно быть",
  "тестовый кейс",
  "тест кейс",
  "проверь",
  "expected:",
  "input:",
];

const LANGUAGE_MAP: Record<string, string> = {
  ts: "ts",
  typescript: "ts",
  js: "js",
  javascript: "js",
  py: "py",
  python: "py",
  json: "json",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  sh: "sh",
  bash: "sh",
  shell: "sh",
  go: "go",
  rust: "rs",
  java: "java",
  cpp: "cpp",
  c: "c",
};

function detectTestScenario(text: string): boolean {
  const normalized = (text || "").trim().toLowerCase();

  const lines = normalized.split("\n").filter(Boolean);
  const quotedLines = lines.filter(
    (line) =>
      line.startsWith('"') ||
      line.startsWith("«") ||
      line.startsWith("'")
  ).length;

  const markerHits = TEST_SCENARIO_MARKERS.reduce(
    (acc, marker) => acc + (normalized.includes(marker) ? 1 : 0),
    0
  );

  return quotedLines >= 2 || (lines.length >= 2 && markerHits >= 2);
}

function detectLanguage(text: string): string | undefined {
  const normalized = (text || "").toLowerCase();

  for (const [key, lang] of Object.entries(LANGUAGE_MAP)) {
    if (normalized.includes(key)) return lang;
  }

  if (/\binterface\s+\w+\s*\{/.test(normalized)) return "ts";
  if (/\bclass\s+\w+/.test(normalized)) return "ts";
  if (/\bdef\s+\w+\(/.test(normalized)) return "py";
  if (/\bSELECT\s+.+FROM/i.test(normalized)) return "sql";
  if (/\bimport\s+React/.test(normalized)) return "tsx";

  return undefined;
}

function shouldForceFileForCode(text: string): boolean {
  const normalized = (text || "").toLowerCase();
  return LARGE_CODE_SIGNALS.some((rx) => rx.test(normalized));
}

function normalizeQuotedPrompt(text: string): string {
  const trimmed = (text || "").trim();

  const match = trimmed.match(/^["«']([\s\S]*?)["»']/);
  if (match) {
    const rest = trimmed.slice(match[0].length).trim();
    if (rest.startsWith("—→") || rest.startsWith("—") || rest.startsWith("→")) {
      return match[1].trim();
    }
  }

  return trimmed;
}

function isCodeRequest(text: string): boolean {
  const normalized = (text || "").toLowerCase();
  return CODE_SIGNALS.some((signal) => normalized.includes(signal.toLowerCase()));
}

export function detectRequestType(text: string): RequestInterpretation {
  const normalizedPrompt = normalizeQuotedPrompt(text);
  const normalized = normalizedPrompt.toLowerCase();
  const detectedLang = detectLanguage(normalized);

  if (detectTestScenario(text)) {
    return {
      type: "test_scenario",
      normalizedPrompt: text.trim(),
      detectedLang,
      forceFile: false,
    };
  }

  const codeRequest = isCodeRequest(normalizedPrompt);

  if (codeRequest) {
    const forceFile = shouldForceFileForCode(normalizedPrompt);

    return {
      type: forceFile ? "large_code_request" : "code_request",
      normalizedPrompt,
      detectedLang,
      forceFile,
    };
  }

  return {
    type: "plain_text",
    normalizedPrompt,
    detectedLang,
    forceFile: false,
  };
}

export function getExpectedOutputMode(interpretation: RequestInterpretation): string {
  switch (interpretation.type) {
    case "test_scenario":
      return "text";
    case "large_code_request":
      return "file";
    case "code_request":
      return interpretation.forceFile ? "file" : "code_block";
    case "plain_text":
    default:
      return "text";
  }
}

export function shouldDetectLanguage(interpretation: RequestInterpretation): boolean {
  return interpretation.type === "code_request" || interpretation.type === "large_code_request";
}