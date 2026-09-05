import type { CreatorBrowserSession } from "./creator-browser-session.js";

export interface CreatorWebProviderAdapter {
  provider_id: "openai:web" | "qwen:web" | "deepseek:web";
  display_name: string;
  urls: { chat: string };
  selectors: {
    input: string[];
    submit: string[];
    output: string[];
    streaming: string[];
    loginWall: string[];
    captcha: string[];
    rateLimit: string[];
  };

  open(session: CreatorBrowserSession): Promise<void>;
  ensureReady(session: CreatorBrowserSession): Promise<void>;
  submitPrompt(session: CreatorBrowserSession, prompt: string): Promise<void>;
  waitForCompletion(session: CreatorBrowserSession, maxWaitMs: number): Promise<void>;
  extract(session: CreatorBrowserSession): Promise<string>;
}
