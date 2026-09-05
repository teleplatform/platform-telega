import type { ProviderProfile } from "./provider-profile.js";
import type { ProviderRouteRequest } from "./provider-decision.js";

const STRENGTH_MAP: Record<string, number> = {
  reasoning: 10,
  coding: 10,
  research: 9,
  review: 8,
  planning: 7,
  summarization: 6,
  translation: 5,
  creative: 4,
  multimodal: 3,
};

export class ProviderScore {
  score(profile: ProviderProfile, request: ProviderRouteRequest): number {
    let score = 0;

    // Task strength match (highest weight)
    const strengthBonus = profile.strengths.includes(request.task_kind) ? 50 : 0;
    score += strengthBonus;

    // Privacy alignment
    if (request.constraints.privacy === "local_only" && profile.privacy.level === "local") score += 30;
    if (request.constraints.privacy === "sensitive" && profile.privacy.allow_sensitive) score += 20;

    // Cost alignment
    if (request.constraints.cost === "free" && (profile.cost.tier === "free" || profile.cost.tier === "low")) score += 15;
    if (request.constraints.cost === "any") score += 5;

    // Reliability bonus
    if (profile.reliability.last_known_status === "healthy") score += profile.reliability.score * 0.1;

    // Context capacity bonus
    if (profile.limits.max_context_tokens >= request.context.used_tokens * 2) score += 10;

    // Quality mode boost
    if (request.constraints.quality === "high" || request.constraints.quality === "contest") {
      if (profile.strengths.includes("reasoning") || profile.strengths.includes("coding")) score += 10;
    }

    // Latency bonus
    if (request.constraints.latency === "fast" && profile.kind === "local") score += 10;
    if (request.constraints.latency === "slow_ok") {
      if (profile.strengths.includes("research") || profile.strengths.includes("reasoning")) score += 5;
    }

    return Math.round(score);
  }
}
