import type { ResolvedProviderConfig } from "../../core/provider-resolution.js";

export interface KimiLocalWebApiProviderConfig {
  provider: "kimi_local_web_api";
  model: string;
  fallbackTo: string[];
  requiresCreatorMode: boolean;
  transport: "api";
}

export const KIMI_LOCAL_WEB_API_MODELS = ["kimi-k3", "kimi-k2.5"] as const;

export type KimiLocalWebApiModel = (typeof KIMI_LOCAL_WEB_API_MODELS)[number];

export const KIMI_LOCAL_WEB_API_DEFAULT_MODEL: KimiLocalWebApiModel = "kimi-k3";

export const KIMI_LOCAL_WEB_API_BRIDGE_URL = process.env.KIMI_LOCAL_WEB_API_BASE_URL || "http://127.0.0.1:9766";

export function getKimiLocalWebApiConfig(): ResolvedProviderConfig {
  return {
    provider: "kimi_local_web_api",
    model: KIMI_LOCAL_WEB_API_DEFAULT_MODEL,
    fallbackTo: ["glm_local_web_api", "deepseek_web", "local"],
    role: "creator",
    source: "explicit",
    rawInput: "kimi_local_web_api:kimi-k3",
  };
}

export const KIMI_LOCAL_WEB_API_CAPABILITIES = {
  transport: "api" as const,
  requiresManualLogin: false,
  allowsAutomatedLogin: true,
  supportsSystemPrompt: true,
  supportsStreaming: true,
  requiresBrowserProfile: false,
  sessionPersistence: "none",
  rateLimitHandling: "cooldown",
  challengeHandling: "cooldown",
  fallbackOnFailure: true,
} as const;

export const KIMI_LOCAL_WEB_API_HEALTH_CHECK = {
  endpoint: `${KIMI_LOCAL_WEB_API_BRIDGE_URL}/health`,
  expectedHostname: "localhost",
  healthTimeoutMs: 5000,
  cooldownOnFailureMs: 30000,
};

export function isKimiLocalWebApiProvider(provider: string): provider is "kimi_local_web_api" {
  return provider === "kimi_local_web_api";
}
