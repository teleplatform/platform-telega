import type { ProviderCapability } from "../../runtime-economics-contracts/src/provider.js";

export interface ProviderScoreResult {
  provider_id: string;
  score: number;
  reasons: string[];
}

export function scoreProvider(provider: ProviderCapability, taskContext: {
  needs_tools?: boolean;
  needs_structured_output?: boolean;
  needs_reasoning?: boolean;
  needs_long_context?: boolean;
  privacy_requirement?: "local_only" | "restricted" | "external_safe";
  cost_preference?: "low" | "medium" | "high";
}): ProviderScoreResult {
  let score = 0;
  const reasons: string[] = [];

  // Capability fit
  if (taskContext.needs_tools && provider.supports_tools) { score += 30; reasons.push("supports_tools"); }
  else if (taskContext.needs_tools) { reasons.push("no_tools_support"); }

  if (taskContext.needs_structured_output && provider.supports_structured_output) { score += 20; reasons.push("supports_structured_output"); }
  if (taskContext.needs_reasoning && provider.supports_reasoning) { score += 20; reasons.push("supports_reasoning"); }
  if (taskContext.needs_long_context && provider.supports_long_context) { score += 10; reasons.push("supports_long_context"); }

  // Privacy fit
  if (taskContext.privacy_requirement) {
    const privacyOrder = { local_only: 0, restricted: 1, external_safe: 2 };
    const providerPrivacy = privacyOrder[provider.privacy_class];
    const requiredPrivacy = privacyOrder[taskContext.privacy_requirement];
    if (providerPrivacy <= requiredPrivacy) { score += 20; reasons.push("privacy_fit"); }
    else { reasons.push("privacy_mismatch"); }
  }

  // Cost fit
  const costOrder = { low: 0, medium: 1, high: 2 };
  if (taskContext.cost_preference) {
    const providerCost = costOrder[provider.cost_tier];
    const prefCost = costOrder[taskContext.cost_preference];
    if (providerCost <= prefCost) { score += 10; reasons.push("cost_fit"); }
    else { score -= 10; reasons.push("cost_exceeds_preference"); }
  }

  // Latency bonus
  if (provider.avg_latency_ms && provider.avg_latency_ms < 2000) { score += 5; reasons.push("low_latency"); }

  return { provider_id: provider.provider_id, score, reasons };
}
