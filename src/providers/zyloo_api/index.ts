import type { ResolvedProviderConfig } from "../../core/provider-resolution.js";

export interface ZylooApiProviderConfig {
  provider: "zyloo_api";
  model: string;
  fallbackTo: string[];
  transport: "api";
}

export const ZYLOO_API_MODELS = [
  "zyloo/kimi-k3",
  "kimi-k3",
] as const;

export type ZylooApiModel = (typeof ZYLOO_API_MODELS)[number];

export const ZYLOO_API_DEFAULT_MODEL: ZylooApiModel = "zyloo/kimi-k3";

export const ZYLOO_API_KEY_ENV = "ZYLOO_API_KEY";
export const ZYLOO_API_KEY_ENV_SECONDARY = "ZYLOO_API_KEY_2";

export const ZYLOO_K3_SPECS = {
  contextWindow: 1_000_000,
  supportsVision: true,
  supportsStreaming: true,
  supportsToolCalling: true,
  supportsStructuredOutput: true,
} as const;

export function resolveZylooApiKey(): string | null {
  const primary = (process.env.ZYLOO_API_KEY || "").trim();
  if (primary) return primary;
  const secondary = (process.env.ZYLOO_API_KEY_2 || "").trim();
  if (secondary) return secondary;
  return null;
}

export function resolveZylooApiKeySlot(): "primary" | "secondary" | null {
  const primary = (process.env.ZYLOO_API_KEY || "").trim();
  if (primary) return "primary";
  const secondary = (process.env.ZYLOO_API_KEY_2 || "").trim();
  if (secondary) return "secondary";
  return null;
}

export function resolveZylooApiKeyWithSlot(): { key: string; slot: "primary" | "secondary" } | null {
  const primary = (process.env.ZYLOO_API_KEY || "").trim();
  if (primary) return { key: primary, slot: "primary" };
  const secondary = (process.env.ZYLOO_API_KEY_2 || "").trim();
  if (secondary) return { key: secondary, slot: "secondary" };
  return null;
}

export function getZylooApiConfig(): ResolvedProviderConfig {
  return {
    provider: "zyloo_api",
    model: ZYLOO_API_DEFAULT_MODEL,
    fallbackTo: ["kimi_local_web_api", "kimi_api", "local"],
    apiKeyEnv: "ZYLOO_API_KEY",
    baseURL: "https://api.zyloo.io/v1",
    role: "user",
    source: "explicit",
    rawInput: "zyloo_api:zyloo/kimi-k3",
  };
}

export const ZYLOO_API_CAPABILITIES = {
  transport: "api" as const,
  requiresManualLogin: false,
  allowsAutomatedLogin: true,
  supportsSystemPrompt: true,
  supportsStreaming: true,
  supportsToolCalling: true,
  supportsStructuredOutput: true,
  supportsVision: true,
  requiresBrowserProfile: false,
  sessionPersistence: "none",
  rateLimitHandling: "cooldown",
  fallbackOnFailure: true,
} as const;

export function isZylooApiProvider(provider: string): provider is "zyloo_api" {
  return provider === "zyloo_api";
}

export function isZylooModel(model: string): boolean {
  return (ZYLOO_API_MODELS as readonly string[]).includes(model);
}

export function isZylooUpstreamModel(model: string): boolean {
  return model.startsWith("zyloo/");
}
