import type { ResolvedProviderConfig } from "../../core/provider-resolution.js";

export interface KimiApiProviderConfig {
  provider: "kimi_api";
  model: string;
  fallbackTo: string[];
  requiresCreatorMode: boolean;
  transport: "api";
}

export const KIMI_API_MODELS = [
  "kimi-k3",
  "kimi-k2.7-code",
  "kimi-k2.7-code-highspeed",
  "kimi-k2.6",
  "kimi-k2.5",
] as const;

export type KimiApiModel = (typeof KIMI_API_MODELS)[number];

export const KIMI_API_DEFAULT_MODEL: KimiApiModel = "kimi-k3";

export const KIMI_LEGACY_MODELS: readonly KimiApiModel[] = ["kimi-k2.5"];

export function isKimiLegacyModel(model: string): boolean {
  return (KIMI_LEGACY_MODELS as readonly string[]).includes(model);
}

export const KIMI_K3_SPECS = {
  contextWindow: 1_000_000,
  reasoningAlwaysOn: true,
  supportsVision: true,
  supportsStreaming: true,
  supportsToolCalling: true,
  supportsStructuredOutput: true,
  supportsDynamicToolLoading: true,
} as const;

export const KIMI_K3_REASONING_PROFILES = {
  default: { reasoning_effort: "max" as const },
} as const;

export type KimiReasoningProfile = keyof typeof KIMI_K3_REASONING_PROFILES;

export function resolveKimiReasoningEffort(profile: KimiReasoningProfile = "default"): string {
  return KIMI_K3_REASONING_PROFILES[profile].reasoning_effort;
}

export function isKimiK3Model(model: string): boolean {
  return model === "kimi-k3";
}

export function resolveKimiApiKey(): string | null {
  const kimiKey = (process.env.KIMI_API_KEY || "").trim();
  if (kimiKey) return kimiKey;
  const moonshotKey = (process.env.MOONSHOT_API_KEY || "").trim();
  if (moonshotKey) return moonshotKey;
  return null;
}

export function getKimiApiConfig(): ResolvedProviderConfig {
  return {
    provider: "kimi_api",
    model: KIMI_API_DEFAULT_MODEL,
    fallbackTo: ["kimi_local_web_api", "glm_api", "deepseek_api", "local"],
    apiKeyEnv: "KIMI_API_KEY",
    baseURL: process.env.KIMI_API_BASE_URL || "https://api.moonshot.ai/v1",
    role: "user",
    source: "explicit",
    rawInput: "kimi_api:kimi-k3",
  };
}

export const KIMI_API_CAPABILITIES = {
  transport: "api" as const,
  requiresManualLogin: false,
  allowsAutomatedLogin: true,
  supportsSystemPrompt: true,
  supportsStreaming: true,
  supportsReasoning: true,
  supportsToolCalling: true,
  supportsStructuredOutput: true,
  supportsVision: true,
  requiresBrowserProfile: false,
  sessionPersistence: "none",
  rateLimitHandling: "cooldown",
  challengeHandling: "cooldown",
  fallbackOnFailure: true,
} as const;

export function isKimiApiProvider(provider: string): provider is "kimi_api" {
  return provider === "kimi_api";
}

export function isKimiFamilyModel(model: string): boolean {
  return (KIMI_API_MODELS as readonly string[]).includes(model);
}
