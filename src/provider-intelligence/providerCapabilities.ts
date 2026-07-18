/**
 * PO-3 — Provider Capability Registry
 *
 * Structured capability profiles for every provider in the Provider Matrix.
 * Used by ProviderIntelligence to score and select providers by intent.
 */

export type CostTier = "free" | "low" | "medium" | "premium";
export type PrivacyLevel = "local" | "trusted_cloud" | "external_web";
export type AuthType = "api_key" | "browser_auth" | "both";

export interface ProviderCapabilities {
  providerId: string;
  displayName: string;
  /** Official API key env var (null if API not available) */
  apiKeyEnv: string | null;
  /** Primary auth type */
  authType: AuthType;
  /** Privacy level of the provider */
  privacy: PrivacyLevel;
  /** Cost tier for API usage */
  costTier: CostTier;
  /** Known models (ordered by capability) */
  models: string[];
  /** Default model for fallback */
  defaultModel: string;

  // ── Capability scores (1–10) ──
  reasoning: number;
  coding: number;
  research: number;
  creative: number;
  summarization: number;
  translation: number;
  webSearch: number;
  planning: number;

  // ── Operational scores (1–10) ──
  latency: number;
  reliability: number;
  streaming: boolean;
  contextWindow: number;

  // ── Cost scores (1–10, lower = cheaper) ──
  costEfficiency: number;

  // ── Tags for cross-cutting concerns ──
  tags: string[];
}

export interface IntentWeightProfile {
  intent: string;
  weights: Partial<Record<keyof Omit<ProviderCapabilities, "providerId" | "displayName" | "apiKeyEnv" | "authType" | "privacy" | "costTier" | "models" | "defaultModel" | "streaming" | "contextWindow" | "tags">, number>>;
}

export const PROVIDER_CAPABILITIES: ProviderCapabilities[] = [
  {
    providerId: "glm_api",
    displayName: "GLM API",
    apiKeyEnv: "GLM_API_KEY",
    authType: "api_key",
    privacy: "trusted_cloud",
    costTier: "low",
    models: ["glm-5-thinking", "glm-5-search", "glm-5-deepresearch", "glm-5", "glm-5-plus"],
    defaultModel: "glm-5-thinking",
    reasoning: 8, coding: 7, research: 10, creative: 6,
    summarization: 8, translation: 9, webSearch: 10, planning: 8,
    latency: 7, reliability: 8, streaming: true, contextWindow: 128000,
    costEfficiency: 8,
    tags: ["chinese", "search", "research"],
  },
  {
    providerId: "glm_local_web_api",
    displayName: "GLM Browser",
    apiKeyEnv: null,
    authType: "browser_auth",
    privacy: "external_web",
    costTier: "free",
    models: ["glm-5-thinking", "glm-5-search", "glm-5-deepresearch"],
    defaultModel: "glm-5-thinking",
    reasoning: 8, coding: 7, research: 10, creative: 6,
    summarization: 8, translation: 9, webSearch: 10, planning: 8,
    latency: 6, reliability: 6, streaming: false, contextWindow: 128000,
    costEfficiency: 10,
    tags: ["chinese", "search", "research", "browser_fallback"],
  },
  {
    providerId: "kimi_api",
    displayName: "Kimi API",
    apiKeyEnv: "KIMI_API_KEY",
    authType: "api_key",
    privacy: "trusted_cloud",
    costTier: "low",
    models: ["kimi-k3", "kimi-k2.7-code", "kimi-k2.7-code-highspeed", "kimi-k2.6", "kimi-k2.5"],
    defaultModel: "kimi-k3",
    reasoning: 9, coding: 9, research: 9, creative: 8,
    summarization: 9, translation: 8, webSearch: 8, planning: 9,
    latency: 6, reliability: 7, streaming: true, contextWindow: 1_000_000,
    costEfficiency: 8,
    tags: ["long-context", "coding", "research", "reasoning", "vision", "k3", "experimental"],
  },
  {
    providerId: "zyloo_api",
    displayName: "Zyloo API",
    apiKeyEnv: "ZYLOO_API_KEY",
    authType: "api_key",
    privacy: "trusted_cloud",
    costTier: "low",
    models: ["zyloo/kimi-k3"],
    defaultModel: "zyloo/kimi-k3",
    reasoning: 9, coding: 9, research: 9, creative: 8,
    summarization: 9, translation: 8, webSearch: 8, planning: 9,
    latency: 6, reliability: 7, streaming: true, contextWindow: 1_000_000,
    costEfficiency: 8,
    tags: ["long-context", "coding", "research", "reasoning", "vision", "k3", "external_api"],
  },
  {
    providerId: "kimi_local_web_api",
    displayName: "Kimi Browser",
    apiKeyEnv: null,
    authType: "browser_auth",
    privacy: "external_web",
    costTier: "free",
    models: ["kimi-k3", "kimi-k2.5"],
    defaultModel: "kimi-k3",
    reasoning: 9, coding: 9, research: 9, creative: 8,
    summarization: 9, translation: 8, webSearch: 8, planning: 9,
    latency: 5, reliability: 6, streaming: false, contextWindow: 1_000_000,
    costEfficiency: 10,
    tags: ["long-context", "coding", "research", "reasoning", "browser_fallback", "k3"],
  },
  {
    providerId: "mimo_api",
    displayName: "Mimo API",
    apiKeyEnv: "MIMO_API_KEY",
    authType: "api_key",
    privacy: "trusted_cloud",
    costTier: "low",
    models: ["mimo-v2.5-pro", "mimo-v2.5", "mimo-v2.0", "mimo-v1.0"],
    defaultModel: "mimo-v2.5-pro",
    reasoning: 7, coding: 7, research: 6, creative: 7,
    summarization: 7, translation: 6, webSearch: 5, planning: 7,
    latency: 7, reliability: 7, streaming: true, contextWindow: 128000,
    costEfficiency: 8,
    tags: ["xiaomi", "general"],
  },
  {
    providerId: "mimo_browser_discovery",
    displayName: "Mimo Browser",
    apiKeyEnv: null,
    authType: "browser_auth",
    privacy: "external_web",
    costTier: "free",
    models: ["mimo-v2.5-pro", "mimo-v2.5"],
    defaultModel: "mimo-v2.5-pro",
    reasoning: 7, coding: 7, research: 6, creative: 7,
    summarization: 7, translation: 6, webSearch: 5, planning: 7,
    latency: 5, reliability: 5, streaming: false, contextWindow: 32000,
    costEfficiency: 10,
    tags: ["xiaomi", "general", "browser_fallback"],
  },
  {
    providerId: "deepseek_web",
    displayName: "DeepSeek Web",
    apiKeyEnv: null,
    authType: "browser_auth",
    privacy: "external_web",
    costTier: "free",
    models: ["deepseek-chat", "deepseek-r1"],
    defaultModel: "deepseek-chat",
    reasoning: 10, coding: 10, research: 7, creative: 5,
    summarization: 6, translation: 5, webSearch: 6, planning: 7,
    latency: 7, reliability: 7, streaming: false, contextWindow: 64000,
    costEfficiency: 10,
    tags: ["reasoning", "coding", "logic", "math"],
  },
  {
    providerId: "deepseek_api",
    displayName: "DeepSeek API",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    authType: "api_key",
    privacy: "trusted_cloud",
    costTier: "low",
    models: ["deepseek-chat", "deepseek-r1"],
    defaultModel: "deepseek-chat",
    reasoning: 10, coding: 10, research: 7, creative: 5,
    summarization: 6, translation: 5, webSearch: 6, planning: 7,
    latency: 8, reliability: 8, streaming: true, contextWindow: 64000,
    costEfficiency: 8,
    tags: ["reasoning", "coding", "logic", "math"],
  },
  {
    providerId: "minimax",
    displayName: "MiniMax Agent",
    apiKeyEnv: null,
    authType: "browser_auth",
    privacy: "external_web",
    costTier: "free",
    models: ["MiniMax-M3", "MiniMax-M2"],
    defaultModel: "MiniMax-M3",
    reasoning: 7, coding: 7, research: 6, creative: 8,
    summarization: 7, translation: 6, webSearch: 5, planning: 7,
    latency: 6, reliability: 6, streaming: false, contextWindow: 128000,
    costEfficiency: 10,
    tags: ["creative", "agent", "productivity", "browser_ui"],
  },
  {
    providerId: "kimi_free_local",
    displayName: "Kimi Free Local",
    apiKeyEnv: null,
    authType: "api_key",
    privacy: "local",
    costTier: "free",
    models: ["kimi-k2", "kimi-k26"],
    defaultModel: "kimi-k2",
    reasoning: 6, coding: 6, research: 5, creative: 5,
    summarization: 6, translation: 5, webSearch: 4, planning: 5,
    latency: 5, reliability: 4, streaming: true, contextWindow: 32000,
    costEfficiency: 10,
    tags: ["experimental", "local", "free"],
  },
  {
    providerId: "openai_api",
    displayName: "OpenAI API",
    apiKeyEnv: "OPENAI_API_KEY",
    authType: "api_key",
    privacy: "trusted_cloud",
    costTier: "medium",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o3", "o4-mini"],
    defaultModel: "gpt-4o-mini",
    reasoning: 9, coding: 9, research: 8, creative: 10,
    summarization: 8, translation: 8, webSearch: 7, planning: 9,
    latency: 9, reliability: 9, streaming: true, contextWindow: 128000,
    costEfficiency: 5,
    tags: ["general", "creative", "reasoning", "premium"],
  },
  {
    providerId: "openai_web",
    displayName: "ChatGPT Web",
    apiKeyEnv: null,
    authType: "browser_auth",
    privacy: "external_web",
    costTier: "free",
    models: ["gpt-4o", "gpt-4o-mini"],
    defaultModel: "gpt-4o",
    reasoning: 9, coding: 9, research: 8, creative: 10,
    summarization: 8, translation: 8, webSearch: 7, planning: 9,
    latency: 6, reliability: 6, streaming: true, contextWindow: 128000,
    costEfficiency: 10,
    tags: ["general", "creative", "reasoning", "browser_fallback"],
  },
  {
    providerId: "qwen_web",
    displayName: "Qwen Web",
    apiKeyEnv: null,
    authType: "browser_auth",
    privacy: "external_web",
    costTier: "free",
    models: ["qwen-plus", "qwen-max"],
    defaultModel: "qwen-plus",
    reasoning: 7, coding: 7, research: 6, creative: 7,
    summarization: 8, translation: 9, webSearch: 6, planning: 6,
    latency: 7, reliability: 7, streaming: false, contextWindow: 32000,
    costEfficiency: 10,
    tags: ["multilingual", "translation", "chinese"],
  },
  {
    providerId: "local",
    displayName: "Local LLM",
    apiKeyEnv: null,
    authType: "api_key",
    privacy: "local",
    costTier: "free",
    models: ["local-demo", "gemma3n", "qwen3:8b", "mistral", "deepseek"],
    defaultModel: "local-demo",
    reasoning: 5, coding: 5, research: 3, creative: 3,
    summarization: 6, translation: 5, webSearch: 1, planning: 4,
    latency: 10, reliability: 8, streaming: true, contextWindow: 8192,
    costEfficiency: 10,
    tags: ["local", "offline", "private", "fast"],
  },
];

export const INTENT_WEIGHT_PROFILES: IntentWeightProfile[] = [
  { intent: "quick_answer", weights: { latency: 10, reliability: 7, reasoning: 3, costEfficiency: 8 } },
  { intent: "code_generation", weights: { coding: 10, reasoning: 7, latency: 6, reliability: 6 } },
  { intent: "code_review", weights: { coding: 10, reasoning: 8, reliability: 7, planning: 5 } },
  { intent: "architecture", weights: { reasoning: 9, planning: 9, reliability: 8, creative: 5 } },
  { intent: "deep_research", weights: { research: 10, reasoning: 8, webSearch: 8, reliability: 7 } },
  { intent: "web_research", weights: { webSearch: 10, research: 7, reliability: 6, latency: 5 } },
  { intent: "creative", weights: { creative: 10, reasoning: 6, coding: 4, costEfficiency: 6 } },
  { intent: "translation", weights: { translation: 10, summarization: 5, latency: 6, costEfficiency: 7 } },
  { intent: "summarization", weights: { summarization: 10, research: 6, translation: 5, contextWindow: 8 } as any },
  { intent: "reasoning", weights: { reasoning: 10, coding: 5, research: 5, reliability: 7 } },
  { intent: "multi_opinion", weights: { reasoning: 7, research: 7, creative: 6, planning: 6 } },
  { intent: "local_private", weights: { privacy: 10, costEfficiency: 10, latency: 8 } as any },
  { intent: "unknown", weights: { reasoning: 6, coding: 5, research: 5, creative: 5, latency: 6, reliability: 6 } },
];

export function getCapability(providerId: string): ProviderCapabilities | undefined {
  return PROVIDER_CAPABILITIES.find(c => c.providerId === providerId);
}

export function getIntentWeights(intent: string): IntentWeightProfile | undefined {
  return INTENT_WEIGHT_PROFILES.find(p => p.intent === intent);
}
