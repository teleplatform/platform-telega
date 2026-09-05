import type { CreatorWebProviderAdapter } from "../web-provider-adapter.types.js";
import type { CreatorBrowserSession } from "../creator-browser-session.js";

export class OpenaiWebAdapter implements CreatorWebProviderAdapter {
  provider_id = "openai:web" as const;
  display_name = "ChatGPT Web";

  urls = { chat: "https://chatgpt.com" };

  selectors = {
    input: ["textarea[data-id='root']", "div[contenteditable='true']"],
    submit: ["button[data-testid='send-button']"],
    output: ["div[data-message-author-role='assistant']", ".markdown"],
    streaming: ["div[data-message-author-role='assistant'].streaming"],
    loginWall: ["button[data-testid='login-button']", "a[href='/auth/login']"],
    captcha: ["iframe[src*='challenges']", "div[data-testid='turnstile']"],
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
