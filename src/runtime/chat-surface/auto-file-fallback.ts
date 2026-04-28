import { LONG_OUTPUT_THRESHOLD, DEFAULT_FILE_CONFIG } from "./chat-surface.types.js";

export interface AutoFileResult {
  needsFallback: boolean;
  preview?: string;
  fileName?: string;
  fileContent?: string;
}

export function shouldUseAutoFileFallback(text: string): boolean {
  if (!DEFAULT_FILE_CONFIG.fallbackEnabled) return false;
  
  if (text.length > LONG_OUTPUT_THRESHOLD) return true;
  
  if (text.includes("```") && text.split("```").length > 3) return true;
  
  if (text.split("\n## ").length > 4) return true;
  
  const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
  if (codeBlocks >= 2) return true;
  
  return false;
}

export async function processAutoFileFallback(
  text: string,
  baseName: string = "response"
): Promise<AutoFileResult> {
  if (!shouldUseAutoFileFallback(text)) {
    return { needsFallback: false };
  }

  const preview = text.slice(0, DEFAULT_FILE_CONFIG.maxPreviewLength);
  
  let extension = "txt";
  if (text.includes("```json")) extension = "json";
  else if (text.includes("```typescript") || text.includes("```ts")) extension = "ts";
  else if (text.includes("```javascript") || text.includes("```js")) extension = "js";
  else if (text.includes("```python") || text.includes("```py")) extension = "py";
  else if (text.includes("## ") && text.includes(":")) extension = "md";

  const fileName = `${baseName}_${Date.now()}.${extension}`;

  return {
    needsFallback: true,
    preview: preview + "\n\n[... full response attached as file ...]",
    fileName,
    fileContent: text,
  };
}

export function formatAutoFileMessage(result: AutoFileResult): string {
  if (!result.needsFallback) return "";
  
  return result.preview || "";
}

export async function attachFileToOutput(
  bot: any,
  chatId: string | number,
  fileName: string,
  fileContent: string
): Promise<{ fileSent: boolean; messageId?: number }> {
  try {
    const { writeFileSync, unlinkSync } = await import("fs");
    const path = await import("path");
    const os = await import("os");
    
    const tempPath = path.join(os.tmpdir(), fileName);
    writeFileSync(tempPath, fileContent, "utf-8");
    
    const msg = await bot.telegram.sendDocument(chatId, { source: tempPath });
    
    unlinkSync(tempPath);
    
    return { fileSent: true, messageId: msg.message_id };
  } catch (e: any) {
    console.error("[auto-file-fallback] send failed:", e);
    return { fileSent: false };
  }
}