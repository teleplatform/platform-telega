import { ChatSession } from "./chat-types";
import crypto from "crypto";

export async function resetToNewChat(
  chat: ChatSession, 
  runtime: { browser: any; page?: any }
): Promise<ChatSession> {
  const isWeb = chat.provider.endsWith("_web");

  if (isWeb && runtime.browser) {
    if (runtime.page && !runtime.page.isClosed()) {
      await runtime.page.close().catch(() => {});
    }

    const context = await runtime.browser.newContext();
    const page = await context.newPage();
    
    const urlMap: Record<string, string> = {
      "chatgpt_web": "https://chatgpt.com",
      "qwen_web": "https://chat.qwenlm.ai",
      "deepseek_web": "https://chat.deepseek.com"
    };

    await page.goto(urlMap[chat.provider] || "https://chatgpt.com", { waitUntil: "domcontentloaded" });
    runtime.page = page;
    chat.pageId = crypto.randomBytes(4).toString('hex');
  }

  chat.contextId = crypto.randomUUID();
  chat.lastAssistantText = null;
  chat.stuckCounter = 0;
  chat.updatedAt = Date.now();

  return chat;
}