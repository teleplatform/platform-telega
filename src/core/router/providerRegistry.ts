// Provider Registry — Pack 3.1
// Canonical registry of available providers with capability metadata

import type { ActorMode } from "../../types/authz.js";
import type { LaneId } from "./lanes.js";

export interface ProviderDescriptor {
  provider_id: string;
  kind: "local" | "remote";
  enabled: boolean;
  lanes: LaneId[];
  supports_reasoning: boolean;
  supports_tools: boolean;
  privacy_class: "local_only" | "remote_allowed";
  budget_class: "low" | "medium" | "high";
  mode_allowlist: ActorMode[];
  model_ids: string[];
  base_url?: string;
  health?: "healthy" | "degraded" | "down";
}

export function buildDefaultProviderRegistry(): ProviderDescriptor[] {
  return [
    {
      provider_id: "local",
      kind: "local",
      enabled: true,
      lanes: ["cheap", "private"],
      supports_reasoning: false,
      supports_tools: false,
      privacy_class: "local_only",
      budget_class: "low",
      mode_allowlist: ["public", "creator", "internal", "system"],
      model_ids: ["local-model"],
      health: "healthy",
    },
    {
      provider_id: "openai",
      kind: "remote",
      enabled: true,
      lanes: ["cheap", "smart", "creator"],
      supports_reasoning: true,
      supports_tools: true,
      privacy_class: "remote_allowed",
      budget_class: "high",
      mode_allowlist: ["creator", "internal", "system"],
      model_ids: ["gpt-4o-mini", "gpt-4o", "gpt-4"],
      health: "healthy",
    },
    {
      provider_id: "anthropic",
      kind: "remote",
      enabled: true,
      lanes: ["smart", "creator"],
      supports_reasoning: true,
      supports_tools: true,
      privacy_class: "remote_allowed",
      budget_class: "high",
      mode_allowlist: ["creator", "internal", "system"],
      model_ids: ["claude-sonnet-4-20250514", "claude-opus-4-20250514"],
      health: "healthy",
    },
    {
      provider_id: "creator-only",
      kind: "remote",
      enabled: true,
      lanes: ["creator"],
      supports_reasoning: true,
      supports_tools: true,
      privacy_class: "remote_allowed",
      budget_class: "high",
      mode_allowlist: ["creator", "internal", "system"],
      model_ids: ["premium-model-v1"],
      health: "healthy",
    },
  ];
}

export function filterProvidersByMode(
  providers: ProviderDescriptor[],
  mode: ActorMode
): ProviderDescriptor[] {
  return providers.filter(
    (p) => p.enabled && p.mode_allowlist.includes(mode)
  );
}

export function filterProvidersByLane(
  providers: ProviderDescriptor[],
  lane: LaneId
): ProviderDescriptor[] {
  return providers.filter((p) => p.lanes.includes(lane));
}

export function filterProvidersByPrivacy(
  providers: ProviderDescriptor[],
  privacy: "prefer_local" | "allow_remote" | "require_local"
): ProviderDescriptor[] {
  if (privacy === "require_local") {
    return providers.filter((p) => p.privacy_class === "local_only");
  }
  if (privacy === "prefer_local") {
    return [...providers].sort((a, b) => {
      if (a.kind === "local" && b.kind !== "local") return -1;
      if (a.kind !== "local" && b.kind === "local") return 1;
      return 0;
    });
  }
  return providers;
}

export function filterProvidersByBudget(
  providers: ProviderDescriptor[],
  budget: "low" | "medium" | "high"
): ProviderDescriptor[] {
  const budgetOrder = { low: 0, medium: 1, high: 2 };
  const maxBudget = budgetOrder[budget];
  return providers.filter(
    (p) => budgetOrder[p.budget_class] <= maxBudget
  );
}

export function getProviderById(
  providers: ProviderDescriptor[],
  providerId: string
): ProviderDescriptor | undefined {
  return providers.find((p) => p.provider_id === providerId);
}

export function isProviderEnabled(
  providers: ProviderDescriptor[],
  providerId: string
): boolean {
  const p = getProviderById(providers, providerId);
  return p?.enabled ?? false;
}
