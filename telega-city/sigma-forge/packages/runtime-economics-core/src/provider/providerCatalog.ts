import type { ProviderCapability } from "../../runtime-economics-contracts/src/provider.js";

export function createProviderCatalog() {
  const providers = new Map<string, ProviderCapability>();

  return {
    registerProvider(capability: ProviderCapability): void {
      providers.set(capability.provider_id, capability);
    },
    getProvider(provider_id: string): ProviderCapability | undefined {
      return providers.get(provider_id);
    },
    listProviders(): ProviderCapability[] {
      return Array.from(providers.values());
    },
  };
}

export function registerDefaultProviders(catalog: ReturnType<typeof createProviderCatalog>): void {
  catalog.registerProvider({ provider_id: "local", provider_type: "local", supports_tools: false, supports_structured_output: false, supports_reasoning: false, supports_long_context: false, privacy_class: "local_only", cost_tier: "low" });
  catalog.registerProvider({ provider_id: "openai", provider_type: "openai", supports_tools: true, supports_structured_output: true, supports_reasoning: true, supports_long_context: true, privacy_class: "external_safe", avg_latency_ms: 2000, cost_tier: "high" });
  catalog.registerProvider({ provider_id: "anthropic", provider_type: "anthropic", supports_tools: true, supports_structured_output: true, supports_reasoning: true, supports_long_context: true, privacy_class: "restricted", avg_latency_ms: 3000, cost_tier: "high" });
}
