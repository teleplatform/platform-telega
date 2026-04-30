export type TaskIntent = "code" | "longform" | "chat";

export type ProductMode = "product" | "service" | "ad" | null;

export interface IntentResult {
  intent: TaskIntent;
  confidence: number;
  reason: string;
  estimatedLength?: number;
  productMode?: ProductMode;
}

const PRODUCT_SIGNALS = {
  product: ["карточка товара", "карточку товара", "описание товара", "product card", "product description"],
  service: ["карточка услуги", "описание услуги", "карточку услуги", "service card", "service description", "услуга", "услуги"],
  ad: ["реклама", "рекламный текст", "ad text", "ad copy", "рекламный пост"],
};

export function detectProductMode(message: string): ProductMode {
  const text = message.toLowerCase();
  if (PRODUCT_SIGNALS.product.some((s) => text.includes(s))) return "product";
  if (PRODUCT_SIGNALS.service.some((s) => text.includes(s))) return "service";
  if (PRODUCT_SIGNALS.ad.some((s) => text.includes(s))) return "ad";
  return null;
}

const CODE_SIGNALS = [
  "fix error", "fix bug", "fix the", "debug", "error in", "bug in",
  "src/", "build", "compile", "typescript", "tsconfig", "javascript",
  "function", "class ", "interface ", "const ", "let ", "import ",
  "export ", "async ", "await ", "=> ", "npm ", "yarn ", "pnpm ",
  "package.json", "node_modules", "webpack", "vite", "esbuild",
  "syntax error", "type error", "runtime error", "stack trace",
  "console.log", "console.error", "throw new", "try {", "catch (",
  "pull request", "git commit", "git push", "merge conflict",
  "sigma forge", "forge", "sigma_forge",
  "write a function", "write code", "refactor", "implement",
  "api endpoint", "rest api", "graphql", "database query",
  "sql ", "mongodb", "postgres", "redis",
];

const FILE_EXT_PATTERN = /(?:^|\s|[/\\])(?:index\.)?(?:ts|tsx|js|jsx|py|rs|go|java)(?:\s|$|[;,)])/;

const LONGFORM_SIGNALS = [
  "write an article", "write a blog", "write a post", "write an essay",
  "write a guide", "write a tutorial", "write a documentation",
  "write a report", "write a summary", "write a review",
  "long article", "long post", "long guide", "long tutorial",
  "detailed article", "detailed guide", "detailed tutorial",
  "comprehensive guide", "comprehensive article",
  "seo article", "seo post", "seo content",
  "3000 words", "4000 words", "5000 words", "long form", "longform",
  "markdown file", "save as", "export as", "document",
  "chapter ", "section ", "introduction", "conclusion",
  "table of contents", "executive summary",
  "напиши статью", "напиши пост", "напиши блог", "напиши обзор",
  "напиши гайд", "напиши туториал", "напиши документацию",
  "напиши отчет", "напиши эссе", "длинная статья", "длинный гайд",
  "подробная статья", "подробный гайд", "5000 слов", "3000 слов",
  "статью на", "гайд по", "обзор по",
  "карточка товара", "карточку товара", "описание товара",
  "описание услуги", "рекламный текст", "ad text",
];

function countSignals(message: string, signals: string[]): number {
  const lower = message.toLowerCase();
  let count = 0;
  for (const signal of signals) {
    if (lower.includes(signal)) {
      count += 1;
    }
  }
  return count;
}

function hasCodeBlock(message: string): boolean {
  return message.includes("```") || message.includes("`");
}

function hasCodeStructure(message: string): boolean {
  const patterns = [
    /function\s+\w+/,
    /class\s+\w+/,
    /interface\s+\w+/,
    /const\s+\w+\s*=/,
    /let\s+\w+\s*=/,
    /import\s+.*\s+from\s+['"]/,
    /export\s+(default\s+)?(function|class|const)/,
    /<\w+[^>]*>/,
    /\w+\s*:\s*(string|number|boolean|void|any|unknown)/,
    /\b(async|await)\b/,
    /\b(if|else|for|while|switch|case|return)\b\s*[\({]/,
  ];
  return patterns.some((p) => p.test(message));
}

function estimateOutputLength(message: string): number {
  const inputLen = message.length;
  const lower = message.toLowerCase();

  if (LONGFORM_SIGNALS.some((s) => lower.includes(s))) {
    if (lower.includes("3000 words")) return 15000;
    if (lower.includes("4000 words")) return 20000;
    if (lower.includes("5000 words")) return 25000;
    if (lower.includes("long article") || lower.includes("detailed article")) return 12000;
    if (lower.includes("long guide") || lower.includes("comprehensive")) return 15000;
    if (lower.includes("seo")) return 8000;
    return 10000;
  }

  if (CODE_SIGNALS.some((s) => lower.includes(s)) || hasCodeBlock(message)) {
    return Math.max(inputLen * 3, 2000);
  }

  if (inputLen > 200) {
    return inputLen * 2;
  }

  return inputLen * 1.5;
}

export function detectTaskIntent(message: string, options?: { role?: string; meta?: Record<string, any> }): IntentResult {
  const lower = message.toLowerCase();
  const trimmed = message.trim();

  if (!trimmed || trimmed.length < 2) {
    return { intent: "chat", confidence: 0.9, reason: "empty_or_too_short" };
  }

  if (options?.meta?.force_intent) {
    const forced = options.meta.force_intent as TaskIntent;
    return { intent: forced, confidence: 1.0, reason: `forced_${forced}` };
  }

  // 1. Product/Service/Ad mode — HIGHEST PRIORITY
  const productMode = detectProductMode(message);
  if (productMode) {
    return {
      intent: "longform",
      confidence: 0.95,
      reason: `product_mode_force: ${productMode}`,
      estimatedLength: 5000,
      productMode,
    };
  }

  const codeScore = countSignals(message, CODE_SIGNALS) + (hasCodeBlock(message) ? 2 : 0) + (hasCodeStructure(message) ? 3 : 0) + (FILE_EXT_PATTERN.test(message) ? 1 : 0);
  const longformScore = countSignals(message, LONGFORM_SIGNALS);

  const estimatedLength = estimateOutputLength(message);
  const isLongformByEstimate = estimatedLength > 8000;

  if (codeScore >= 2 && codeScore > longformScore) {
    return {
      intent: "code",
      confidence: Math.min(0.7 + codeScore * 0.1, 0.98),
      reason: `code_signals=${codeScore},longform_signals=${longformScore}`,
      estimatedLength,
    };
  }

  if (codeScore >= 1 && longformScore === 0 && hasCodeStructure(message)) {
    return {
      intent: "code",
      confidence: 0.75,
      reason: `code_structure_detected,signals=${codeScore}`,
      estimatedLength,
    };
  }

  if (longformScore >= 2 || (longformScore >= 1 && isLongformByEstimate && codeScore === 0)) {
    return {
      intent: "longform",
      confidence: Math.min(0.6 + longformScore * 0.15, 0.95),
      reason: `longform_signals=${longformScore},estimated_length=${estimatedLength}`,
      estimatedLength,
    };
  }

  if (longformScore >= 1 && codeScore === 0) {
    return {
      intent: "longform",
      confidence: 0.55,
      reason: `weak_longform_signals=${longformScore}`,
      estimatedLength,
    };
  }

  return {
    intent: "chat",
    confidence: 0.8,
    reason: "default_chat",
    estimatedLength,
  };
}

export function shouldRouteToLongform(intent: IntentResult): boolean {
  return intent.intent === "longform" && intent.confidence >= 0.55;
}

export function shouldRouteToOpenAIWeb(intent: IntentResult): boolean {
  return intent.intent === "code" && intent.confidence >= 0.7;
}
