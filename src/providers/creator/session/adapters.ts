import type { Page } from "playwright";
import type { WebAdapter } from "./browser-runtime.js";

export type SessionProviderId = "chatgpt_web" | "qwen_web" | "deepseek_web" | "kimi_web";

const OPENAI_WEB_URL = "https://chatgpt.com";
const QWEN_WEB_URL = "https://qianwen.aliyun.com";
const DEEPSEEK_WEB_URL = "https://chat.deepseek.com";
const KIMI_WEB_URL = "https://kimi.moonshot.cn";

export class OpenAIWebAdapter implements WebAdapter {
  readonly providerId: SessionProviderId = "chatgpt_web";
  readonly loginUrl = OPENAI_WEB_URL;
  readonly inputSelector = 'textarea[id="prompt-textarea"], [data-testid="composer-input"], textarea[placeholder*="message"]';
  readonly submitSelector = 'button[data-testid="send-button"], button[aria-label="Send"], button:has-text("Send")';
  readonly outputSelector = '[data-message-author-role="assistant"], .assistant-message, [class*="message-assistant"]';
  readonly loadingSelector = '[data-state="loading"], [class*="loading"], [aria-busy="true"]';
  readonly maxRetries = 3;

  async navigate(page: Page): Promise<void> {
    await page.goto(this.loginUrl);
  }

  async fillPrompt(page: Page, prompt: string): Promise<void> {
    const textarea = page.locator(this.inputSelector);
    await textarea.fill(prompt);
  }

  async submit(page: Page): Promise<void> {
    const button = page.locator(this.submitSelector);
    await button.click();
  }

  async waitForResponse(page: Page): Promise<string> {
    const loading = page.locator(this.loadingSelector);
    
    try {
      await loading.waitFor({ state: "visible", timeout: 5000 });
    } catch {
    }
    
    await loading.waitFor({ state: "hidden", timeout: 25000 });
    
    const outputs = page.locator(this.outputSelector);
    const count = await outputs.count();
    
    if (count === 0) {
      throw new Error("No response found");
    }
    
    const lastOutput = outputs.nth(count - 1);
    return await lastOutput.textContent() || "";
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    } catch {}

    const url = page.url();
    const title = await page.title().catch(() => "");
    
    if (url.includes("accounts.google.com") || url.includes("signin")) {
      console.log(`[isLoggedIn] Google OAuth detected: URL=${url}, Title=${title}`);
      return false;
    }
    
    if (url.includes("/login") || url.includes("/signin") || url.includes("/auth") || url.includes("/new-chat")) {
      if (title.includes("Log in") || title.includes("Войти") || title.includes("войти")) {
        return false;
      }
    }
    
    if (title.includes("Один момент") || title.includes("Just a moment") || title.includes("Checking")) {
      await page.waitForTimeout(3000);
    }
    
    const isChatGPT =
      typeof url === "string" &&
      (
        url.startsWith("https://chatgpt.com") ||
        url.startsWith("https://chat.openai.com") ||
        url.includes("chatgpt.com")
      );
    
    if (isChatGPT) {
      await page.waitForTimeout(2000);
    }
    
    try {
      const sendButton = page.locator(this.submitSelector);
      await sendButton.waitFor({ state: "visible", timeout: 5000 });
      return true;
    } catch {
      try {
        const textarea = page.locator(this.inputSelector);
        await textarea.waitFor({ state: "visible", timeout: 5000 });
        return true;
      } catch {
        try {
          const chatContainer = page.locator('[data-testid="chat-container"]');
          await chatContainer.waitFor({ state: "visible", timeout: 3000 });
          return true;
        } catch {
          const main = page.locator('main');
          await main.waitFor({ state: "visible", timeout: 3000 });
          return true;
        }
      }
    }
  }
}

export class QwenWebAdapter implements WebAdapter {
  readonly providerId: SessionProviderId = "qwen_web";
  readonly loginUrl = QWEN_WEB_URL;
  readonly inputSelector = 'textarea[placeholder*="输入"]';
  readonly submitSelector = 'button:has-text("发送")';
  readonly outputSelector = '[class*="message-assistant"]';
  readonly loadingSelector = 'button:disabled';
  readonly maxRetries = 3;

  async navigate(page: Page): Promise<void> {
    await page.goto(this.loginUrl);
  }

  async fillPrompt(page: Page, prompt: string): Promise<void> {
    const textarea = page.locator(this.inputSelector);
    await textarea.fill(prompt);
  }

  async submit(page: Page): Promise<void> {
    const button = page.locator(this.submitSelector);
    await button.click();
  }

  async waitForResponse(page: Page): Promise<string> {
    const loading = page.locator(this.loadingSelector);
    
    try {
      await loading.waitFor({ state: "visible", timeout: 5000 });
    } catch {
    }
    
    await loading.waitFor({ state: "hidden", timeout: 30000 });
    
    const outputs = page.locator(this.outputSelector);
    const count = await outputs.count();
    
    if (count === 0) {
      throw new Error("No response found");
    }
    
    const lastOutput = outputs.nth(count - 1);
    return await lastOutput.textContent() || "";
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    const url = page.url();
    
    if (url.includes("/login") || url.includes("/auth")) {
      return false;
    }
    
    try {
      const textarea = page.locator(this.inputSelector);
      await textarea.waitFor({ state: "visible", timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}

export class DeepSeekWebAdapter implements WebAdapter {
  readonly providerId: SessionProviderId = "deepseek_web";
  readonly loginUrl = DEEPSEEK_WEB_URL;
  readonly inputSelector = 'textarea[placeholder*="Ask"]';
  readonly submitSelector = 'button[data-testid="send-btn"]';
  readonly outputSelector = '[data-message-type="assistant"]';
  readonly loadingSelector = '[class*="loading"]';
  readonly maxRetries = 3;

  async navigate(page: Page): Promise<void> {
    await page.goto(this.loginUrl);
  }

  async fillPrompt(page: Page, prompt: string): Promise<void> {
    const textarea = page.locator(this.inputSelector);
    await textarea.fill(prompt);
  }

  async submit(page: Page): Promise<void> {
    const button = page.locator(this.submitSelector);
    await button.click();
  }

  async waitForResponse(page: Page): Promise<string> {
    const loading = page.locator(this.loadingSelector);
    
    try {
      await loading.waitFor({ state: "visible", timeout: 5000 });
    } catch {
    }
    
    await loading.waitFor({ state: "hidden", timeout: 30000 });
    
    const outputs = page.locator(this.outputSelector);
    const count = await outputs.count();
    
    if (count === 0) {
      throw new Error("No response found");
    }
    
    const lastOutput = outputs.nth(count - 1);
    return await lastOutput.textContent() || "";
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    const url = page.url();
    
    if (url.includes("/login") || url.includes("/auth")) {
      return false;
    }
    
    try {
      const sendButton = page.locator(this.submitSelector);
      await sendButton.waitFor({ state: "visible", timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}

export class KimiWebAdapter implements WebAdapter {
  readonly providerId: SessionProviderId = "kimi_web";
  readonly loginUrl = KIMI_WEB_URL;
  readonly inputSelector = 'textarea[placeholder*="发送消息"]';
  readonly submitSelector = 'button:has-text("发送")';
  readonly outputSelector = '[class*="message-assistant"]';
  readonly loadingSelector = '[class*="loading"]';
  readonly maxRetries = 3;

  async navigate(page: Page): Promise<void> {
    await page.goto(this.loginUrl);
  }

  async fillPrompt(page: Page, prompt: string): Promise<void> {
    const textarea = page.locator(this.inputSelector);
    await textarea.fill(prompt);
  }

  async submit(page: Page): Promise<void> {
    const button = page.locator(this.submitSelector);
    await button.click();
  }

  async waitForResponse(page: Page): Promise<string> {
    const loading = page.locator(this.loadingSelector);
    
    try {
      await loading.waitFor({ state: "visible", timeout: 5000 });
    } catch {
    }
    
    await loading.waitFor({ state: "hidden", timeout: 30000 });
    
    const outputs = page.locator(this.outputSelector);
    const count = await outputs.count();
    
    if (count === 0) {
      throw new Error("No response found");
    }
    
    const lastOutput = outputs.nth(count - 1);
    return await lastOutput.textContent() || "";
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    const url = page.url();
    
    if (url.includes("/login") || url.includes("/auth")) {
      return false;
    }
    
    try {
      const sendButton = page.locator(this.submitSelector);
      await sendButton.waitFor({ state: "visible", timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}

export function getWebAdapter(providerId: SessionProviderId): WebAdapter {
  switch (providerId) {
    case "chatgpt_web":
      return new OpenAIWebAdapter();
    case "qwen_web":
      return new QwenWebAdapter();
    case "deepseek_web":
      return new DeepSeekWebAdapter();
    case "kimi_web":
      return new KimiWebAdapter();
    default:
      throw new Error(`Creator Bridge provider ${providerId} is not implemented yet.`);
  }
}