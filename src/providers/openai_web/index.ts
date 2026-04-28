import type { WebProviderId } from "../web/cdp/cdp.types.js";
import type { ResolvedProviderConfig } from "../../core/provider-resolution.js";

export interface OpenAIWebProviderConfig {
  provider: "chatgpt_web";
  model: string;
  fallbackTo: WebProviderId[];
  role: "creator";
  transport: "web_cdp";
}

export const OPENAI_WEB_MODEL = "gpt-4o";

export function getOpenAIWebConfig(): ResolvedProviderConfig {
  return {
    provider: "chatgpt_web",
    model: OPENAI_WEB_MODEL,
    fallbackTo: ["qwen_web", "deepseek_web", "openai_api", "local"],
    role: "creator",
    source: "explicit",
    rawInput: "chatgpt_web:gpt-4o",
  };
}

export const OPENAI_WEB_CAPABILITIES = {
  transport: "web_cdp" as const,
  requiresManualLogin: true,
  allowsAutomatedLogin: false,
  supportsSystemPrompt: true,
  supportsStreaming: false,
  requiresBrowserProfile: true,
  sessionPersistence: "manual",
  rateLimitHandling: "cooldown",
  challengeHandling: "cooldown",
  fallbackOnFailure: true,
};

export const OPENAI_WEB_HEALTH_CHECK = {
  endpoint: "http://127.0.0.1:9222",
  expectedHostname: "chatgpt.com",
  loginUrl: "https://chatgpt.com",
  healthTimeoutMs: 10000,
  cooldownOnFailureMs: 300000,
};

export function isOpenAIWebProvider(provider: string): provider is "openai_web" {
  return provider === "openai_web";
}