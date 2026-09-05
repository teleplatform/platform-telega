import type { CreatorWebProviderAdapter } from "../web-provider-adapter.types.js";
import type { CreatorBrowserSession } from "../creator-browser-session.js";

export class DeepseekWebAdapter implements CreatorWebProviderAdapter {
  provider_id = "deepseek:web" as const;
  display_name = "DeepSeek Web";

  urls = { chat: "https://chat.deepseek.com" };

  selectors = {
    input: ["textarea.w-full", "div[contenteditable='true']"],
    submit: ["button.send", "button[type='submit']"],
    output: [".ds-markdown", ".assistant-message"],
    streaming: [".ds-markdown.streaming"],
    loginWall: ["a[href*='login']", "button:has-text('Sign in')"],
    captcha: ["div.captcha-container", "iframe[src*='challenge']"],
    rateLimit: ["div:has-text('rate limit')", "div:has-text('too many requests')"],
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
