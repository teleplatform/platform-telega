export type ApiProviderId = "openai:api" | "qwen:api" | "deepseek:api";

export type ProviderAccessTier = "local_model" | "api_model" | "creator_web";

export interface ApiProviderStatus {
  provider_id: ApiProviderId;
  enabled: boolean;
  has_credentials: boolean;
  health: "healthy" | "missing_credentials" | "failed" | "unknown";
  last_checked_at?: string;
}

export interface ApiProviderConfig {
  provider_id: ApiProviderId;
  display_name: string;
  api_key_env: string;
  endpoint: string;
}

export interface ModeSwitchResult {
  success: boolean;
  previous_tier: ProviderAccessTier | undefined;
  new_tier: ProviderAccessTier;
  message: string;
}
