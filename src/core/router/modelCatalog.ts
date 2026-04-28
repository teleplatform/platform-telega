// Model Catalog — Pack 3.1
// Model-level metadata for intelligent routing

import type { LaneId } from "./lanes.js";

export type CapabilityTag =
  | "reasoning"
  | "coding"
  | "creative"
  | "analysis"
  | "tool_use"
  | "long_context"
  | "fast_response"
  | "multilingual";

export interface ModelDescriptor {
  model_id: string;
  provider_id: string;
  lane_fit: LaneId[];
  capability_tags: CapabilityTag[];
  reasoning_score: number; // 0-100
  cost_score: number; // 0-100 (higher = more expensive)
  privacy_class: "local" | "remote";
  creator_only?: boolean;
  deprecated?: boolean;
  max_context_tokens?: number;
  max_output_tokens?: number;
}

export function buildDefaultModelCatalog(): ModelDescriptor[] {
  return [
    {
      model_id: "local-model",
      provider_id: "local",
      lane_fit: ["cheap", "private"],
      capability_tags: ["fast_response", "multilingual"],
      reasoning_score: 30,
      cost_score: 5,
      privacy_class: "local",
    },
    {
      model_id: "gpt-4o-mini",
      provider_id: "openai",
      lane_fit: ["cheap", "smart"],
      capability_tags: ["reasoning", "coding", "tool_use", "multilingual"],
      reasoning_score: 70,
      cost_score: 30,
      privacy_class: "remote",
    },
    {
      model_id: "gpt-4o",
      provider_id: "openai",
      lane_fit: ["smart", "creator"],
      capability_tags: ["reasoning", "coding", "creative", "tool_use", "long_context", "multilingual"],
      reasoning_score: 90,
      cost_score: 60,
      privacy_class: "remote",
    },
    {
      model_id: "gpt-4",
      provider_id: "openai",
      lane_fit: ["smart", "creator"],
      capability_tags: ["reasoning", "coding", "analysis", "tool_use", "long_context"],
      reasoning_score: 95,
      cost_score: 80,
      privacy_class: "remote",
    },
    {
      model_id: "claude-sonnet-4-20250514",
      provider_id: "anthropic",
      lane_fit: ["smart"],
      capability_tags: ["reasoning", "coding", "analysis", "tool_use", "long_context"],
      reasoning_score: 88,
      cost_score: 50,
      privacy_class: "remote",
    },
    {
      model_id: "claude-opus-4-20250514",
      provider_id: "anthropic",
      lane_fit: ["smart", "creator"],
      capability_tags: ["reasoning", "coding", "creative", "analysis", "tool_use", "long_context"],
      reasoning_score: 97,
      cost_score: 90,
      privacy_class: "remote",
    },
    {
      model_id: "premium-model-v1",
      provider_id: "creator-only",
      lane_fit: ["creator"],
      capability_tags: ["reasoning", "coding", "creative", "analysis", "tool_use", "long_context", "multilingual"],
      reasoning_score: 99,
      cost_score: 95,
      privacy_class: "remote",
      creator_only: true,
    },
  ];
}

export function filterModelsByLane(
  models: ModelDescriptor[],
  lane: LaneId
): ModelDescriptor[] {
  return models.filter((m) => m.lane_fit.includes(lane));
}

export function filterModelsByProvider(
  models: ModelDescriptor[],
  providerId: string
): ModelDescriptor[] {
  return models.filter((m) => m.provider_id === providerId);
}

export function filterModelsByCapability(
  models: ModelDescriptor[],
  tag: CapabilityTag
): ModelDescriptor[] {
  return models.filter((m) => m.capability_tags.includes(tag));
}

export function filterNonDeprecated(
  models: ModelDescriptor[]
): ModelDescriptor[] {
  return models.filter((m) => !m.deprecated);
}

export function filterCreatorOnly(
  models: ModelDescriptor[],
  isCreator: boolean
): ModelDescriptor[] {
  if (isCreator) return models;
  return models.filter((m) => !m.creator_only);
}

export function getModelById(
  models: ModelDescriptor[],
  modelId: string
): ModelDescriptor | undefined {
  return models.find((m) => m.model_id === modelId);
}
