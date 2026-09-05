import type { CreatorWebProviderAdapter } from "../web-provider-adapter.types.js";
import type { CreatorBrowserSession } from "../creator-browser-session.js";

export class QwenWebAdapter implements CreatorWebProviderAdapter {
  provider_id = "qwen:web" as const;
  display_name = "Qwen Web";

  urls = { chat: "https://chat.qwen.ai" };

  selectors = {
    input: ["textarea.chat-input", "div[contenteditable='true']"],
    submit: ["button.send-btn", "button[type='submit']"],
    output: [".chat-message-content", ".assistant-message"],
    streaming: [".chat-message-content.streaming"],
    loginWall: ["a[href='/login']", "button:has-text('Log in')"],
    captcha: ["div.captcha", "iframe[src*='captcha']"],
    rateLimit: ["div:has-text('rate limit')", "div:has-text('too frequent')"],
  };

  async open(session: CreatorBrowserSession): Promise<void> {
    await session.open(this.urls.chat);
    await session.waitForReady([this.urls.chat], 10000);
  }

  async ensureReady(session: CreatorBrowserSession): Promise<void> {
    const loginVisible = await session.isVisible(this.selectors.loginWall);
    if (loginVisible) throw new Error("LOGIN_REQUIRED");

    const captchaVisible = await session.isVisible(this.selectors.captcha);
    if (captchaVisible) throw new Error("CAPTCHA_REQUIRED");
  }

  async submitPrompt(session: CreatorBrowserSession, prompt: string): Promise<void> {
    await session.type(this.selectors.input, prompt);
    await session.click(this.selectors.submit);
  }

  async waitForCompletion(session: CreatorBrowserSession, maxWaitMs: number): Promise<void> {
    await session.waitForReady(this.selectors.output, maxWaitMs);
  }

  async extract(session: CreatorBrowserSession): Promise<string> {
    return session.read(this.selectors.output);
  }
}
