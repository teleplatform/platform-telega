import type { ProviderKind, ProviderStrength, ProviderAccessTier, RuntimeAccessMode } from "./provider.types.js";

export interface ProviderLimits {
  max_context_tokens: number;
  supports_files: boolean;
  supports_images: boolean;
  supports_web_research: boolean;
  supports_code_execution: boolean;
}

export interface ProviderCost {
  tier: "free" | "low" | "medium" | "high";
  metered: boolean;
}

export interface ProviderPrivacy {
  level: "local" | "trusted_cloud" | "external_web";
  allow_sensitive: boolean;
}

export interface ProviderReliability {
  score: number;
  last_known_status: "healthy" | "degraded" | "unknown";
}

export interface ProviderProfile {
  provider_id: string;
  kind: ProviderKind;
  access_tier: ProviderAccessTier;
  display_name: string;

  allowed_modes: RuntimeAccessMode[];

  strengths: ProviderStrength[];

  limits: ProviderLimits;

  cost: ProviderCost;

  privacy: ProviderPrivacy;

  reliability: ProviderReliability;

  enabled: boolean;
}
