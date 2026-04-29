export interface MultiBlockConfig {
  ignoreUISelectors: string[];
  minTextLength: number;
  maxWaitMs: number;
  includeStreaming: boolean;
  minValidLength: number;
}

export const DEFAULT_MULTIBLOCK_CONFIG: MultiBlockConfig = {
  ignoreUISelectors: [
    "button", "svg", "[role=button]", "[data-button]",
    ".loading", ".spinner", "[data-state=loading]",
  ],
  minTextLength: 500,
  maxWaitMs: 60000,
  includeStreaming: true,
  minValidLength: 500,
};

const LONG_PROMPT_KEYWORDS = ["3000", "article", "статья", "long", "подробно", "развернуто", "detailed", "comprehensive"];

function isLongPrompt(prompt: string): boolean {
  return LONG_PROMPT_KEYWORDS.some((kw) => prompt.toLowerCase().includes(kw));
}

function getMinLength(prompt: string): number {
  return isLongPrompt(prompt) ? 25000 : 500;
}

function getConversationTurns(document: Document): Element[] {
  const selectors = [
    'article[data-testid*="conversation-turn"]',
    'article[data-testid*="conversation"]',
    'article[class*="conversation-turn"]',
    "[data-testid=conversation-turn]",
    "[data-message-thread]",
  ];
  const turns: Element[] = [];
  for (const sel of selectors) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (!turns.includes(el)) turns.push(el);
      }
    } catch {}
  }
  return turns;
}

function findAssistantInTurn(turn: Element): Element | null {
  const selectors = [
    '[data-message-author-role="assistant"]',
    '[data-role="assistant"]',
    '[data-msg-author="assistant"]',
  ];
  for (const sel of selectors) {
    try {
      const el = turn.querySelector(sel);
      if (el) return el;
    } catch {}
  }
  return null;
}

export function extractAssistantResponse(document: Document, prompt: string): {
  text: string;
  turnsCount: number;
  assistantFound: boolean;
  isValid: boolean;
  reason: string;
} {
  const turns = getConversationTurns(document);
  if (turns.length === 0) {
    console.log(JSON.stringify({ event: "extraction_v6", reason: "no_turns" }));
    return { text: "", turnsCount: 0, assistantFound: false, isValid: false, reason: "no conversation turns found" };
  }
  
  const lastTurn = turns[turns.length - 1];
  const assistant = findAssistantInTurn(lastTurn);
  
  if (!assistant) {
    console.log(JSON.stringify({ event: "extraction_v6", turns_count: turns.length, reason: "no_assistant" }));
    return { text: "", turnsCount: turns.length, assistantFound: false, isValid: false, reason: "no assistant message in turn" };
  }
  
  const text = assistant.textContent?.trim() || "";
  const minLen = getMinLength(prompt);
  const isValid = text.length >= minLen && text.length >= DEFAULT_MULTIBLOCK_CONFIG.minValidLength;
  
  console.log(JSON.stringify({
    event: "extraction_v6",
    turns_count: turns.length,
    assistant_found: true,
    text_length: text.length,
    min_required: minLen,
    is_valid: isValid,
  }));
  
  return {
    text,
    turnsCount: turns.length,
    assistantFound: true,
    isValid,
    reason: isValid
      ? `turn ${turns.length}, ${text.length} chars`
      : `too short: ${text.length} < ${minLen}`,
  };
}

export interface ExtractedImages {
  urls: string[];
  count: number;
}

function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:image/");
}

export function extractImages(document: Document): ExtractedImages {
  const turns = getConversationTurns(document);
  if (turns.length === 0) return { urls: [], count: 0 };
  
  const lastTurn = turns[turns.length - 1];
  const assistant = findAssistantInTurn(lastTurn);
  
  if (!assistant) return { urls: [], count: 0 };
  
  const urls: string[] = [];
  try {
    const imgs = assistant.querySelectorAll("img");
    for (const img of imgs) {
      const src = (img as HTMLImageElement).src;
      if (isValidImageUrl(src) && !urls.includes(src)) {
        urls.push(src);
      }
    }
  } catch {}
  
  return { urls, count: urls.length };
}

export function extractFullResponse(document: Document, prompt: string): {
  text: string;
  images: ExtractedImages;
  turnsCount: number;
  isValid: boolean;
} {
  const textResult = extractAssistantResponse(document, prompt);
  const imagesResult = extractImages(document);
  return {
    text: textResult.text,
    images: imagesResult,
    turnsCount: textResult.turnsCount,
    isValid: textResult.isValid,
  };
}