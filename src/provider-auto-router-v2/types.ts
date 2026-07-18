export type ProviderIntent =
  | "fast_chat"
  | "code_small"
  | "code_large"
  | "long_text"
  | "reasoning"
  | "creative"
  | "technical_debug"
  | "unknown";

export type ProviderCapability =
  | "fast"
  | "reasoning"
  | "code"
  | "long_context"
  | "creative"
  | "web_bridge"
  | "api"
  | "experimental";

export type ProviderId =
  | "openai_api" | "openai_web"
  | "qwen_api" | "qwen_web"
  | "deepseek_api" | "deepseek_web"
  | "kimi_web" | "kimi_free_local" | "kimi_api" | "kimi_local_web_api"
  | "zyloo_api"
  | "gemini_web" | "claude_web"
  | "glm_local_web_api"
  | "minimax" | "grok_web"
  | "local";

export type ProviderTier = "stable" | "beta" | "experimental" | "disabled";

export interface ProviderCandidate {
  provider: ProviderId;
  displayName: string;
  tier: ProviderTier;
  capabilities: ProviderCapability[];
  score: number;
  reasons: string[];
}

export interface AutoRouterDecision {
  selectedProvider: ProviderId;
  selectedModel?: string;
  intent: ProviderIntent;
  score: number;
  reason: string[];
  candidates: ProviderCandidate[];
  allowExperimental: boolean;
}
