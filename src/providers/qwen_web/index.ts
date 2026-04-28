import type { WebProviderId } from "../web/cdp/cdp.types.js";
import type { ResolvedProviderConfig } from "../../core/provider-resolution.js";

export interface QwenWebProviderConfig {
  provider: "qwen_web";
  model: string;
  fallbackTo: WebProviderId[];
  requiresCreatorMode: boolean;
  transport: "web_cdp";
}

export const QWEN_WEB_MODEL = "qwen-plus";

export function getQwenWebConfig(): ResolvedProviderConfig {
  return {
    provider: "qwen_web",
    model: QWEN_WEB_MODEL,
    fallbackTo: ["deepseek_web", "openai_api", "local"],
    role: "creator",
    source: "explicit",
    rawInput: "qwen_web:qwen-plus",
  };
}

export const QWEN_WEB_CAPABILITIES = {
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

export const QWEN_WEB_HEALTH_CHECK = {
  endpoint: "http://127.0.0.1:9222",
  expectedHostname: "qwen.ai",
  loginUrl: "https://qwen.ai",
  healthTimeoutMs: 10000,
  cooldownOnFailureMs: 300000,
};

export function isQwenWebProvider(provider: string): provider is "qwen_web" {
  return provider === "qwen_web";
}