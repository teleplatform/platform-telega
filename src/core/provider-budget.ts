import type { ProviderId } from "./provider-resolution.js";
import { getPricing, calculateCost } from "./provider-pricing.js";

export type BudgetPolicy = {
  max_cost_per_request: number;    // max USD per single request
  max_cost_per_session: number;    // max USD per session
  prefer_cheaper: boolean;          // prefer cheaper providers when possible
  tier_cap?: "free" | "cheap" | "standard" | "premium"; // max tier allowed
};

export const DEFAULT_BUDGET_POLICY: BudgetPolicy = {
  max_cost_per_request: 0.50,      // $0.50 per request
  max_cost_per_session: 10.0,       // $10 per session
  prefer_cheaper: true,             // prefer cheaper providers
  tier_cap: "premium",              // allow all tiers by default
};

export type BudgetState = {
  session_spent: number;            // total spent this session
  request_spent: number;            // spent on current request
  remaining: number;                 // remaining budget
  allowed: boolean;                  // is request allowed
  reason?: string;                  // denial reason if not allowed
};

export function checkBudget(
  provider: ProviderId,
  model: string,
  inputTokens: number,
  outputTokens: number,
  policy: BudgetPolicy,
  sessionSpent: number
): BudgetState {
  const estimatedCost = calculateCost(provider, model, inputTokens, outputTokens);
  
  // Check per-request limit
  if (estimatedCost > policy.max_cost_per_request) {
    return {
      session_spent: sessionSpent,
      request_spent: estimatedCost,
      remaining: Math.max(0, policy.max_cost_per_session - sessionSpent),
      allowed: false,
      reason: `Request cost $${estimatedCost.toFixed(4)} exceeds limit $${policy.max_cost_per_request}`,
    };
  }
  
  // Check session limit
  if (sessionSpent + estimatedCost > policy.max_cost_per_session) {
    return {
      session_spent: sessionSpent,
      request_spent: estimatedCost,
      remaining: Math.max(0, policy.max_cost_per_session - sessionSpent),
      allowed: false,
      reason: `Session cost would exceed limit: $${(sessionSpent + estimatedCost).toFixed(2)} > $${policy.max_cost_per_session}`,
    };
  }
  
  return {
    session_spent: sessionSpent,
    request_spent: estimatedCost,
    remaining: policy.max_cost_per_session - sessionSpent - estimatedCost,
    allowed: true,
  };
}

export function filterByBudget(
  candidates: ProviderId[],
  policy: BudgetPolicy
): ProviderId[] {
  if (!policy.prefer_cheaper) return candidates;
  
  const tierOrder: BudgetPolicy["tier_cap"][] = ["free", "cheap", "standard", "premium"];
  const maxTierIndex = tierOrder.indexOf(policy.tier_cap || "premium");
  
  // Filter candidates by allowed tier
  return candidates.filter(provider => {
    // For now, map providers to tiers - in production this would be dynamic
    const providerTiers: Record<ProviderId, BudgetPolicy["tier_cap"]> = {
      local: "free",
      openai_web: "premium",
      chatgpt_web: "premium",
      qwen_web: "cheap",
      deepseek_web: "cheap",
      grok_web: "premium",
      kimi_web: "premium",
      perplexity_web: "premium",
      claude_web: "premium",
      openai_api: "premium",
      qwen_api: "cheap",
      deepseek_api: "cheap",
    };
    
    const providerTier = providerTiers[provider] || "premium";
    const providerTierIndex = tierOrder.indexOf(providerTier);
    
    return providerTierIndex <= maxTierIndex;
  });
}

export type BudgetStatus = {
  tier: string;
  spent_today: number;
  daily_limit: number;
  blocks_today: number;
  last_decision: string;
};

export function getBudgetStatus(userId: string): BudgetStatus {
  // Placeholder implementation - in production this would track actual user spending
  return {
    tier: "free",
    spent_today: 0,
    daily_limit: DEFAULT_BUDGET_POLICY.max_cost_per_session,
    blocks_today: 0,
    last_decision: "allowed",
  };
}

export function selectCheapestProvider(
  candidates: ProviderId[],
  model?: string
): ProviderId | null {
  if (candidates.length === 0) return null;
  
  // Prefer local, then qwen_api, then deepseek_api, then openai_api
  const preferenceOrder: ProviderId[] = ["local", "qwen_api", "deepseek_api", "openai_api"];
  
  for (const preferred of preferenceOrder) {
    if (candidates.includes(preferred)) {
      return preferred;
    }
  }
  
  return candidates[0];
}
