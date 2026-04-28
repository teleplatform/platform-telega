// Provider Access Matrix — Pack 2.4
// Mode-based provider/model/lane access rules

import type {
  ActorMode,
  ProviderAccessRule,
  ProviderAccessDecision,
} from "../../types/authz.js";

export const DEFAULT_PROVIDER_RULES: ProviderAccessRule[] = [
  {
    provider_id: "local",
    allowed_modes: ["public", "creator", "internal", "system"],
    allowed_models: ["local-model"],
    lane: "cheap",
  },
  {
    provider_id: "openai",
    allowed_modes: ["creator", "internal", "system"],
    allowed_models: ["gpt-4o-mini", "gpt-4o", "gpt-4"],
    lane: "smart",
  },
  {
    provider_id: "anthropic",
    allowed_modes: ["creator", "internal", "system"],
    allowed_models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514"],
    lane: "smart",
  },
  {
    provider_id: "creator-only",
    allowed_modes: ["creator", "internal", "system"],
    lane: "creator",
  },
];

export function checkProviderAccess(
  providerId: string,
  mode: ActorMode,
  model?: string,
  rules: ProviderAccessRule[] = DEFAULT_PROVIDER_RULES
): ProviderAccessDecision {
  const rule = rules.find((r) => r.provider_id === providerId);

  if (!rule) {
    return {
      allowed: false,
      provider_id: providerId,
      model,
      reason: `unknown_provider:${providerId}`,
    };
  }

  if (!rule.allowed_modes.includes(mode)) {
    return {
      allowed: false,
      provider_id: providerId,
      model,
      lane: rule.lane,
      reason: `mode_not_allowed:${mode} for provider:${providerId}`,
    };
  }

  if (model && rule.allowed_models && !rule.allowed_models.includes(model)) {
    return {
      allowed: false,
      provider_id: providerId,
      model,
      lane: rule.lane,
      reason: `model_not_allowed:${model} for provider:${providerId}`,
    };
  }

  return {
    allowed: true,
    provider_id: providerId,
    model,
    lane: rule.lane,
    reason: "allowed",
  };
}

export function getAvailableProviders(mode: ActorMode): ProviderAccessRule[] {
  return DEFAULT_PROVIDER_RULES.filter((r) => r.allowed_modes.includes(mode));
}

export function getAvailableModels(
  providerId: string,
  mode: ActorMode
): string[] {
  const rule = DEFAULT_PROVIDER_RULES.find((r) => r.provider_id === providerId);
  if (!rule) return [];
  if (!rule.allowed_modes.includes(mode)) return [];
  return rule.allowed_models ?? [];
}
