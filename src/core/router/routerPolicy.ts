// Router Policy — Pack 3.2
// Routing rules that govern lane/provider/model selection

import type { ActorMode } from "../../types/authz.js";
import type { LaneId } from "./lanes.js";
import type { ProviderDescriptor } from "./providerRegistry.js";
import type { ModelDescriptor } from "./modelCatalog.js";

export type PromptClass = "simple" | "reasoning" | "creative" | "tooling" | "research";
export type BudgetClass = "low" | "medium" | "high";
export type PrivacyPreference = "prefer_local" | "allow_remote" | "require_local";

export interface RouterPolicy {
  actor_mode: ActorMode;
  prompt_class: PromptClass;
  budget_class: BudgetClass;
  privacy_preference: PrivacyPreference;
  requested_provider?: string;
  requested_model?: string;
  needs_tools: boolean;
  needs_reasoning: boolean;
  allowed_providers: string[];
  allowed_models: string[];
}

export function buildRouterPolicy(
  actorMode: ActorMode,
  options?: {
    prompt_class?: PromptClass;
    budget_class?: BudgetClass;
    privacy_preference?: PrivacyPreference;
    requested_provider?: string;
    requested_model?: string;
    needs_tools?: boolean;
    needs_reasoning?: boolean;
  }
): RouterPolicy {
  const promptClass = options?.prompt_class ?? inferPromptClass(actorMode);
  const budgetClass = options?.budget_class ?? inferBudgetClass(actorMode);
  const privacyPreference = options?.privacy_preference ?? "allow_remote";
  const needsTools = options?.needs_tools ?? false;
  const needsReasoning = options?.needs_reasoning ?? (promptClass === "reasoning" || promptClass === "research");

  return {
    actor_mode: actorMode,
    prompt_class: promptClass,
    budget_class: budgetClass,
    privacy_preference: privacyPreference,
    requested_provider: options?.requested_provider,
    requested_model: options?.requested_model,
    needs_tools: needsTools,
    needs_reasoning: needsReasoning,
    allowed_providers: [],
    allowed_models: [],
  };
}

function inferPromptClass(mode: ActorMode): PromptClass {
  switch (mode) {
    case "system":
    case "internal":
      return "research";
    case "creator":
      return "reasoning";
    default:
      return "simple";
  }
}

function inferBudgetClass(mode: ActorMode): BudgetClass {
  switch (mode) {
    case "system":
      return "high";
    case "internal":
      return "high";
    case "creator":
      return "medium";
    default:
      return "low";
  }
}

export function filterProvidersByPolicy(
  providers: ProviderDescriptor[],
  policy: RouterPolicy
): ProviderDescriptor[] {
  let result = providers.filter((p) => p.enabled);

  result = result.filter((p) => p.mode_allowlist.includes(policy.actor_mode));

  if (policy.allowed_providers.length > 0) {
    result = result.filter((p) => policy.allowed_providers.includes(p.provider_id));
  }

  if (policy.privacy_preference === "require_local") {
    result = result.filter((p) => p.privacy_class === "local_only");
  }

  if (policy.budget_class === "low") {
    result = result.filter((p) => p.budget_class === "low");
  }

  // Tool/reasoning requirements are scoring factors, not hard filters
  // (we still want to route even if no provider perfectly matches)

  return result;
}

export function filterModelsByPolicy(
  models: ModelDescriptor[],
  policy: RouterPolicy
): ModelDescriptor[] {
  let result = models.filter((m) => !m.deprecated);

  result = result.filter((m) => {
    if (m.creator_only && policy.actor_mode !== "creator" && policy.actor_mode !== "internal" && policy.actor_mode !== "system") {
      return false;
    }
    return true;
  });

  if (policy.allowed_models.length > 0) {
    result = result.filter((m) => policy.allowed_models.includes(m.model_id));
  }

  if (policy.privacy_preference === "require_local") {
    result = result.filter((m) => m.privacy_class === "local");
  }

  // Tool/reasoning requirements are scoring factors, not hard filters
  if (policy.needs_tools) {
    result = result.filter((m) => m.capability_tags.includes("tool_use") || m.provider_id === "local");
  }

  if (policy.needs_reasoning) {
    result = result.filter((m) => m.reasoning_score >= 70);
  }

  return result;
}

export function determineLaneFromPolicy(policy: RouterPolicy): LaneId {
  if (policy.privacy_preference === "require_local") {
    return "private";
  }
  if (policy.actor_mode === "creator" && policy.prompt_class === "reasoning") {
    return "creator";
  }
  if (policy.needs_reasoning || policy.prompt_class === "reasoning" || policy.prompt_class === "research") {
    return "smart";
  }
  if (policy.budget_class === "low") {
    return "cheap";
  }
  return "cheap";
}
