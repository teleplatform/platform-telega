// Router Scoring — Pack 3.2
// Deterministic, testable, explainable scoring for candidate evaluation

import type { LaneId } from "./lanes.js";
import type { ProviderDescriptor } from "./providerRegistry.js";
import type { ModelDescriptor } from "./modelCatalog.js";
import type { PromptClass, BudgetClass, PrivacyPreference, RouterPolicy } from "./routerPolicy.js";

export interface ScoreFactors {
  lane_match: number;
  intent_fit: number;
  mode_fit: number;
  privacy_fit: number;
  budget_fit: number;
  tool_fit: number;
  provider_health: number;
  model_capability_fit: number;
}

export interface ScoredCandidate {
  provider_id: string;
  model_id: string;
  lane: LaneId;
  score: number;
  factors: ScoreFactors;
}

const WEIGHTS = {
  lane_match: 30,
  intent_fit: 20,
  mode_fit: 20,
  privacy_fit: 15,
  budget_fit: 15,
  tool_fit: 10,
  provider_health: 5,
  model_capability_fit: 25,
};

export function scoreCandidate(
  provider: ProviderDescriptor,
  model: ModelDescriptor,
  lane: LaneId,
  policy: RouterPolicy
): ScoredCandidate {
  const factors: ScoreFactors = {
    lane_match: computeLaneMatch(model, lane),
    intent_fit: computeIntentFit(model, policy.prompt_class),
    mode_fit: computeModeFit(provider, policy.actor_mode),
    privacy_fit: computePrivacyFit(provider, policy.privacy_preference),
    budget_fit: computeBudgetFit(provider, policy.budget_class),
    tool_fit: computeToolFit(provider, model, policy.needs_tools),
    provider_health: computeProviderHealth(provider),
    model_capability_fit: computeCapabilityFit(model, policy.needs_reasoning),
  };

  const score =
    factors.lane_match * WEIGHTS.lane_match +
    factors.intent_fit * WEIGHTS.intent_fit +
    factors.mode_fit * WEIGHTS.mode_fit +
    factors.privacy_fit * WEIGHTS.privacy_fit +
    factors.budget_fit * WEIGHTS.budget_fit +
    factors.tool_fit * WEIGHTS.tool_fit +
    factors.provider_health * WEIGHTS.provider_health +
    factors.model_capability_fit * WEIGHTS.model_capability_fit;

  return {
    provider_id: provider.provider_id,
    model_id: model.model_id,
    lane,
    score: Math.round(score * 100) / 100,
    factors,
  };
}

export function rankCandidates(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return [...candidates].sort((a, b) => b.score - a.score);
}

function computeLaneMatch(model: ModelDescriptor, lane: LaneId): number {
  return model.lane_fit.includes(lane) ? 1 : 0;
}

function computeIntentFit(model: ModelDescriptor, promptClass: PromptClass): number {
  if (promptClass === "reasoning" || promptClass === "research") {
    return model.reasoning_score / 100;
  }
  if (promptClass === "creative") {
    return model.capability_tags.includes("creative") ? 1 : 0.5;
  }
  if (promptClass === "tooling") {
    return model.capability_tags.includes("tool_use") ? 1 : 0.3;
  }
  return 0.8;
}

function computeModeFit(provider: ProviderDescriptor, mode: string): number {
  return provider.mode_allowlist.includes(mode as any) ? 1 : 0;
}

function computePrivacyFit(provider: ProviderDescriptor, privacy: PrivacyPreference): number {
  if (privacy === "require_local") {
    return provider.privacy_class === "local_only" ? 1 : 0;
  }
  if (privacy === "prefer_local") {
    return provider.kind === "local" ? 1 : 0.5;
  }
  return 1;
}

function computeBudgetFit(provider: ProviderDescriptor, budget: BudgetClass): number {
  const budgetOrder = { low: 0, medium: 1, high: 2 };
  const providerCost = budgetOrder[provider.budget_class];
  const maxBudget = budgetOrder[budget];
  if (providerCost <= maxBudget) return 1;
  return 0;
}

function computeToolFit(provider: ProviderDescriptor, model: ModelDescriptor, needsTools: boolean): number {
  if (!needsTools) return 1;
  return (provider.supports_tools && model.capability_tags.includes("tool_use")) ? 1 : 0;
}

function computeProviderHealth(provider: ProviderDescriptor): number {
  switch (provider.health) {
    case "healthy": return 1;
    case "degraded": return 0.5;
    case "down": return 0;
    default: return 1;
  }
}

function computeCapabilityFit(model: ModelDescriptor, needsReasoning: boolean): number {
  if (!needsReasoning) return 0.8;
  return model.reasoning_score / 100;
}
