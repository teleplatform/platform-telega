export type ProviderType = "local" | "openai" | "anthropic" | "custom";

export interface ProviderCapability {
  provider_id: string;
  provider_type: ProviderType;
  supports_tools: boolean;
  supports_structured_output: boolean;
  supports_reasoning: boolean;
  supports_long_context: boolean;
  privacy_class: "local_only" | "restricted" | "external_safe";
  avg_latency_ms?: number;
  cost_tier: "low" | "medium" | "high";
}
