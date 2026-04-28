import type { ProviderId } from "./provider-resolution.js";

export type PricingTier = "free" | "cheap" | "standard" | "premium";

export type ProviderPricing = {
  provider: ProviderId;
  model: string;
  
  input_cost_per_1m: number;
  output_cost_per_1m: number;
  
  tier: PricingTier;
};

const PROVIDER_PRICING: ProviderPricing[] = [
  // Local - free
  {
    provider: "local",
    model: "*",
    input_cost_per_1m: 0,
    output_cost_per_1m: 0,
    tier: "free",
  },
  
  // Qwen API - cheap
  {
    provider: "qwen_api",
    model: "qwen-plus",
    input_cost_per_1m: 0.8,
    output_cost_per_1m: 2.0,
    tier: "standard",
  },
  
  // DeepSeek API - cheap to standard
  {
    provider: "deepseek_api",
    model: "deepseek-chat",
    input_cost_per_1m: 0.27,
    output_cost_per_1m: 1.1,
    tier: "cheap",
  },
  
  // OpenAI API - premium
  {
    provider: "openai_api",
    model: "gpt-4o-mini",
    input_cost_per_1m: 0.4,
    output_cost_per_1m: 1.6,
    tier: "standard",
  },
  {
    provider: "openai_api",
    model: "gpt-4o",
    input_cost_per_1m: 2.5,
    output_cost_per_1m: 10.0,
    tier: "premium",
  },
  
  // Web providers - creator tier
  {
    provider: "chatgpt_web",
    model: "gpt-4o",
    input_cost_per_1m: 0,
    output_cost_per_1m: 0,
    tier: "free",
  },
  {
    provider: "qwen_web",
    model: "qwen-plus",
    input_cost_per_1m: 0,
    output_cost_per_1m: 0,
    tier: "free",
  },
  {
    provider: "deepseek_web",
    model: "deepseek-chat",
    input_cost_per_1m: 0,
    output_cost_per_1m: 0,
    tier: "free",
  },
];

export function getPricing(provider: ProviderId, model: string): ProviderPricing | null {
  const exactMatch = PROVIDER_PRICING.find(p => p.provider === provider && p.model === model);
  if (exactMatch) return exactMatch;
  
  const wildcardMatch = PROVIDER_PRICING.find(p => p.provider === provider && p.model === "*");
  return wildcardMatch || null;
}

export function calculateCost(
  provider: ProviderId,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getPricing(provider, model);
  if (!pricing) return 0;
  
  const inputCost = (inputTokens / 1_000_000) * pricing.input_cost_per_1m;
  const outputCost = (outputTokens / 1_000_000) * pricing.output_cost_per_1m;
  
  return inputCost + outputCost;
}

export function getProvidersByTier(tier: PricingTier): ProviderPricing[] {
  return PROVIDER_PRICING.filter(p => p.tier === tier);
}

export function getCheapestProvider(model?: string): ProviderPricing | null {
  const available = model
    ? PROVIDER_PRICING.filter(p => p.model === model)
    : PROVIDER_PRICING.filter(p => p.tier === "free" || p.tier === "cheap");
  
  if (available.length === 0) return null;
  
  return available.reduce((min, p) => {
    const minCost = min.input_cost_per_1m + min.output_cost_per_1m;
    const pCost = p.input_cost_per_1m + p.output_cost_per_1m;
    return pCost < minCost ? p : min;
  });
}
