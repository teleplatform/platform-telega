import type { WebProviderId } from "../web/cdp/cdp.types.js";
import type { ResolvedProviderConfig } from "../../core/provider-resolution.js";

export interface DeepSeekWebProviderConfig {
  provider: "deepseek_web";
  model: string;
  fallbackTo: WebProviderId[];
  requiresCreatorMode: boolean;
  transport: "web_cdp";
}

export const DEEPSEEK_WEB_MODEL = "deepseek-chat";

export function getDeepSeekWebConfig(): ResolvedProviderConfig {
  return {
    provider: "deepseek_web",
    model: DEEPSEEK_WEB_MODEL,
    fallbackTo: ["creator", "local"],
    requiresCreatorMode: true,
    source: "explicit",
    rawInput: "deepseek_web:deepseek-chat",
  };
}

export const DEEPSEEK_WEB_CAPABILITIES = {
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

export const DEEPSEEK_WEB_HEALTH_CHECK = {
  endpoint: "http://127.0.0.1:9222",
  expectedHostname: "chat.deepseek.com",
  loginUrl: "https://chat.deepseek.com",
  healthTimeoutMs: 10000,
  cooldownOnFailureMs: 300000,
};

export function isDeepSeekWebProvider(provider: string): provider is "deepseek_web" {
  return provider === "deepseek_web";
}