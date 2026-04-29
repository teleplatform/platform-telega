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
  minTextLength: 20000,
  maxWaitMs: 60000,
  includeStreaming: true,
  minValidLength: 500,
};

const LONG_PROMPT_KEYWORDS = ["3000", "article", "статья", "long", "подробно", "развернуто", "detailed", "comprehensive"];

function isLongPrompt(prompt: string): boolean {
  return LONG_PROMPT_KEYWORDS.some((kw) => prompt.toLowerCase().includes(kw));
}

function getMinLength(prompt: string): number {
  return isLongPrompt(prompt) ? 25000 : 1000;
}

function cleanText(text: string, ignore: string[]): string {
  text = text.trim();
  for (const sel of ignore) {
    text = text.replace(new RegExp(sel, "gi"), "");
  }
  text = text.replace(/\n{3,}/g, "\n\n").replace(/^[ \t]+/gm, "");
  return text.trim();
}

function deduplicate(blocks: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const block of blocks) {
    const n = block.trim();
    if (n && n.length > 10 && !seen.has(n)) {
      seen.add(n);
      unique.push(n);
    }
  }
  return unique;
}

function getAssistantBlocks(document: Document): Element[] {
  const selectors = [
    '[data-message-author-role="assistant"]',
    '[data-msg-author="assistant"]',
    '[data-role="assistant"]',
    '[class*="assistant"]',
    ".assistant-msg",
  ];
  const results: Element[] = [];
  for (const sel of selectors) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (!results.includes(el)) results.push(el);
      }
    } catch {}
  }
  return results;
}

function getLastResponseGroup(document: Document): string[] {
  const blocks = getAssistantBlocks(document);
  if (blocks.length === 0) return [];
  
  const groups: string[][] = [];
  let currentGroup: string[] = [];
  
  for (const block of blocks) {
    const text = cleanText(block.textContent || "", DEFAULT_MULTIBLOCK_CONFIG.ignoreUISelectors);
    if (text && text.length > 10) {
      currentGroup.push(text);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    }
  }
  
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups.length > 0 ? groups[groups.length - 1] : [];
}

export function extractAssistantResponse(document: Document, prompt: string): {
  text: string;
  blocksCount: number;
  groupsCount: number;
  isValid: boolean;
  reason: string;
} {
  const lastGroup = getLastResponseGroup(document);
  if (lastGroup.length === 0) {
    console.log(JSON.stringify({ event: "extraction_failed", reason: "no_blocks" }));
    return { text: "", blocksCount: 0, groupsCount: 0, isValid: false, reason: "no assistant blocks found" };
  }
  const uniqueBlocks = deduplicate(lastGroup);
  const fullText = uniqueBlocks.join("\n\n");
  const minLen = getMinLength(prompt);
  const isValid = fullText.length >= minLen && fullText.length >= DEFAULT_MULTIBLOCK_CONFIG.minValidLength;
  console.log(JSON.stringify({
    event: "extraction_v5",
    groups_count: 1,
    group_blocks: lastGroup.length,
    unique_blocks: uniqueBlocks.length,
    extracted_length: fullText.length,
    min_required: minLen,
    is_valid: isValid,
  }));
  return {
    text: fullText,
    blocksCount: uniqueBlocks.length,
    groupsCount: 1,
    isValid,
    reason: isValid
      ? `group with ${uniqueBlocks.length} blocks, ${fullText.length} chars`
      : `too short: ${fullText.length} < ${minLen}`,
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
  const urls: string[] = [];
  const selectors = [
    '[data-message-author-role="assistant"] img',
    ".assistant-msg img",
    "[class*=\"assistant\"] img",
  ];
  for (const sel of selectors) {
    try {
      const imgs = document.querySelectorAll(sel);
      for (const img of imgs) {
        const src = (img as HTMLImageElement).src;
        if (isValidImageUrl(src) && !urls.includes(src)) {
          urls.push(src);
        }
      }
    } catch {}
  }
  return { urls, count: urls.length };
}

export function extractFullResponse(document: Document, prompt: string): {
  text: string;
  images: ExtractedImages;
  blocksCount: number;
  isValid: boolean;
} {
  const textResult = extractAssistantResponse(document, prompt);
  const imagesResult = extractImages(document);
  return {
    text: textResult.text,
    images: imagesResult,
    blocksCount: textResult.blocksCount,
    isValid: textResult.isValid,
  };
}