import type { ProviderCapability, ProviderId, ProviderTier } from "./types.js";

export interface ProviderCapabilityEntry {
  providerId: ProviderId;
  displayName: string;
  tier: ProviderTier;
  capabilities: ProviderCapability[];
  free: boolean;
}

const CAPABILITY_REGISTRY: ProviderCapabilityEntry[] = [
  { providerId: "openai_api", displayName: "OpenAI API", tier: "stable", capabilities: ["fast", "reasoning", "code", "long_context", "creative", "api"], free: false },
  { providerId: "openai_web", displayName: "OpenAI Web", tier: "stable", capabilities: ["reasoning", "creative", "long_context", "web_bridge"], free: false },
  { providerId: "qwen_api", displayName: "Qwen API", tier: "stable", capabilities: ["fast", "code", "reasoning", "api"], free: false },
  { providerId: "qwen_web", displayName: "Qwen Web", tier: "stable", capabilities: ["fast", "code", "reasoning", "web_bridge"], free: true },
  { providerId: "deepseek_api", displayName: "DeepSeek API", tier: "stable", capabilities: ["fast", "reasoning", "code", "long_context", "api"], free: false },
  { providerId: "deepseek_web", displayName: "DeepSeek Web", tier: "stable", capabilities: ["reasoning", "code", "long_context", "technical_debug", "web_bridge"], free: true },
  { providerId: "kimi_api", displayName: "Kimi API", tier: "experimental", capabilities: ["reasoning", "code", "long_context", "api"], free: false },
  { providerId: "kimi_web", displayName: "Kimi Web", tier: "stable", capabilities: ["reasoning", "long_context", "web_bridge"], free: true },
  { providerId: "gemini_web", displayName: "Gemini Web", tier: "stable", capabilities: ["reasoning", "creative", "long_context", "web_bridge"], free: true },
  { providerId: "claude_web", displayName: "Claude Web", tier: "stable", capabilities: ["reasoning", "code", "creative", "long_context", "web_bridge"], free: false },
  { providerId: "kimi_local_web_api", displayName: "Kimi Browser", tier: "stable", capabilities: ["reasoning", "code", "long_context", "web_bridge"], free: true },
  { providerId: "glm_local_web_api", displayName: "GLM Browser", tier: "stable", capabilities: ["reasoning", "code", "web_bridge"], free: true },
  { providerId: "minimax", displayName: "MiniMax Agent", tier: "stable", capabilities: ["creative", "fast", "web_bridge"], free: false },
  { providerId: "grok_web", displayName: "Grok Web", tier: "stable", capabilities: ["fast", "reasoning", "web_bridge"], free: false },
  { providerId: "kimi_free_local", displayName: "Kimi Free Local", tier: "experimental", capabilities: ["fast", "code", "api", "experimental"], free: true },
];

export function getProviderCapabilities(providerId: string): ProviderCapabilityEntry | undefined {
  return CAPABILITY_REGISTRY.find(p => p.providerId === providerId);
}

export function getAllProviders(): ProviderCapabilityEntry[] {
  return [...CAPABILITY_REGISTRY];
}

export function getStableProviders(): ProviderCapabilityEntry[] {
  return CAPABILITY_REGISTRY.filter(p => p.tier === "stable");
}

export function getExperimentalProviders(): ProviderCapabilityEntry[] {
  return CAPABILITY_REGISTRY.filter(p => p.tier === "experimental");
}

export function getFreeProviders(): ProviderCapabilityEntry[] {
  return CAPABILITY_REGISTRY.filter(p => p.free);
}
