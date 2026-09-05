import type { ProviderStrength, RuntimeAccessMode } from "./provider.types.js";
import type { RuntimeIntent, RuntimeRiskLevel } from "../intent/intent.types.js";

export interface ProviderRouteRequest {
  run_id: string;
  trace_id: string;

  runtime_mode: RuntimeAccessMode;

  task_kind: ProviderStrength;
  intent: RuntimeIntent;
  risk_level: RuntimeRiskLevel;

  context: {
    used_tokens: number;
    max_tokens: number;
    has_files: boolean;
    has_images: boolean;
  };

  constraints: {
    quality: "normal" | "high" | "contest";
    latency: "fast" | "normal" | "slow_ok";
    cost: "free" | "low" | "any";
    privacy: "normal" | "sensitive" | "local_only";
  };
}

export interface BlockedProvider {
  provider_id: string;
  reason: string;
}

export interface ProviderDecision {
  provider_id: string;
  capability_id: string;
  reason: string;
  score: number;
  fallback_provider_ids: string[];
  blocked_providers: BlockedProvider[];
}
