export interface MultiBlockConfig {
  ignoreUISelectors: string[];
  minTextLength: number;
  maxWaitMs: number;
  includeStreaming: boolean;
}

export const DEFAULT_MULTIBLOCK_CONFIG: MultiBlockConfig = {
  ignoreUISelectors: [
    "button",
    "svg",
    "[role=button]",
    "[data-button]",
    ".loading",
    ".spinner",
    "[data-state=loading]",
  ],
  minTextLength: 2000,
  maxWaitMs: 60000,
  includeStreaming: true,
};

const LONG_PROMPT_MIN_LENGTH = 2500;
const NORMAL_PROMPT_MIN_LENGTH = 1000;

function isLongPrompt(prompt: string): boolean {
  const keywords = ["3000", "article", "статья", "long", "подробно", "развернуто", "detailed", "comprehensive"];
  return keywords.some((kw) => prompt.toLowerCase().includes(kw));
}

function getMinTextLength(prompt: string): number {
  return isLongPrompt(prompt) ? LONG_PROMPT_MIN_LENGTH : NORMAL_PROMPT_MIN_LENGTH;
}

function cleanBlockText(text: string, ignoreSelectors: string[]): string {
  text = text.trim();
  
  for (const sel of ignoreSelectors) {
    text = text.replace(new RegExp(sel, "gi"), "");
  }
  
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/^[ \t]+/gm, "");
  
  return text.trim();
}

function deduplicateBlocks(blocks: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  
  for (const block of blocks) {
    const normalized = block.trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      unique.push(normalized);
    }
  }
  
  return unique;
}

export function extractMultiBlockResponse(
  document: Document,
  prompt: string,
  config: MultiBlockConfig = DEFAULT_MULTIBLOCK_CONFIG
): {
  text: string;
  blocksCount: number;
  isComplete: boolean;
  meetsMinLength: boolean;
  reason: string;
} {
  const allBlocks: string[] = [];
  
  const assistantSelectors = [
    "[data-message-author-role=assistant]",
    "[data-role=assistant]",
    "[class*=assistant]",
    '[class*="message-assistant"]',
    ".assistant-message",
    "[data-testid=assistant-message]",
  ];
  
  for (const selector of assistantSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.trim() || "";
        if (text && text.length > 10) {
          allBlocks.push(cleanBlockText(text, config.ignoreUISelectors));
        }
      }
    } catch {}
  }
  
  if (config.includeStreaming) {
    const streamingContainers = document.querySelectorAll("[data-state=streaming], .streaming, [data-streaming=true]");
    for (const el of streamingContainers) {
      const text = el.textContent?.trim() || "";
      if (text && text.length > 10) {
        allBlocks.push(cleanBlockText(text, config.ignoreUISelectors));
      }
    }
  }
  
  const uniqueBlocks = deduplicateBlocks(allBlocks);
  
  const lastBlock = uniqueBlocks.length > 0 
    ? uniqueBlocks[uniqueBlocks.length - 1] 
    : "";
  
  const isComplete = uniqueBlocks.length > 0;
  const minLength = getMinTextLength(prompt);
  const meetsMinLength = lastBlock.length >= minLength;
  
  console.log(JSON.stringify({
    event: "extraction_v4_1",
    total_blocks: uniqueBlocks.length,
    extracted_length: lastBlock.length,
    using_last_block: true,
  }));
  
  return {
    text: lastBlock,
    blocksCount: uniqueBlocks.length,
    isComplete,
    meetsMinLength,
    reason: isComplete 
      ? `last of ${uniqueBlocks.length} blocks, ${lastBlock.length} chars`
      : "no assistant blocks found",
  };
}

export interface ImageExtractionResult {
  images: Array<{
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }>;
  detectedCount: number;
  validCount: number;
}

function isValidImageSrc(src: string): boolean {
  if (!src) return false;
  return src.startsWith("https://") || 
         src.startsWith("http://") || 
         src.startsWith("blob:") ||
         src.startsWith("data:image/");
}

export function extractImagesFromDocument(document: Document): ImageExtractionResult {
  const images: ImageExtractionResult["images"] = [];
  const imageSelectors = [
    "img[src]",
    "[data-message-author-role=assistant] img",
    ".assistant-message img",
    "[class*=assistant] img",
  ];
  
  for (const selector of imageSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const src = (el as HTMLImageElement).src;
        const alt = el.getAttribute("alt") || undefined;
        
        if (isValidImageSrc(src)) {
          const width = (el as HTMLImageElement).width || undefined;
          const height = (el as HTMLImageElement).height || undefined;
          
          if (!images.some((i) => i.src === src)) {
            images.push({ src, alt, width, height });
          }
        }
      }
    } catch {}
  }
  
  return {
    images,
    detectedCount: images.length,
    validCount: images.length,
  };
}

export function extractMultiBlockWithImages(
  document: Document,
  prompt: string,
  config: MultiBlockConfig = DEFAULT_MULTIBLOCK_CONFIG
): {
  text: string;
  images: ImageExtractionResult;
  blocksCount: number;
  meetsMinLength: boolean;
  isComplete: boolean;
} {
  const textResult = extractMultiBlockResponse(document, prompt, config);
  const imagesResult = extractImagesFromDocument(document);
  
  return {
    text: textResult.text,
    images: imagesResult,
    blocksCount: textResult.blocksCount,
    meetsMinLength: textResult.meetsMinLength,
    isComplete: textResult.isComplete,
  };
}