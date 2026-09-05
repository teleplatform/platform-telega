import type { ProviderAccessTier, RuntimeAccessMode } from "./provider.types.js";

export type ProviderConnectivityStatus =
  | "healthy"
  | "blocked_by_mode"
  | "missing_credentials"
  | "login_required"
  | "rate_limited"
  | "timeout"
  | "failed"
  | "skipped";

export interface ProviderConnectivityResult {
  provider_id: string;
  access_tier: ProviderAccessTier;
  runtime_mode: RuntimeAccessMode;
  status: ProviderConnectivityStatus;
  latency_ms?: number;
  reason: string;
}
