import type { CapabilityKind, CapabilityTrustLevel } from "../capability-vnext/capability.types.js";
import type { ActionRouteKind } from "../routing/action-route.types.js";
import type { AvailabilityStatus, RuntimeTarget } from "../availability/availability.types.js";
import type { IntentResult } from "../intent/intent.types.js";
import type { Action, ResourceKind, VisibilityScope } from "../../types/authz.js";
import type { ProviderStrength, RuntimeAccessMode } from "../provider/provider.types.js";

export interface DispatchAuthzContext {
  action: Action;
  resource_kind: ResourceKind;
  resource_id: string;
  is_owner: boolean;
  visibility_scope: VisibilityScope;
}

export interface DispatchProviderRequirements {
  runtime_mode: RuntimeAccessMode;
  task_kind: ProviderStrength;
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

export interface DispatchRequest {
  run_id: string;
  trace_id: string;
  intent: IntentResult;
  capability_kind: CapabilityKind;
  subject: string;
  authz: DispatchAuthzContext;
  provider?: DispatchProviderRequirements;
  execution_payload?: Record<string, unknown>;
}

export interface DispatchPlanCapability {
  capability_id: string;
  kind: CapabilityKind;
  trust_level: CapabilityTrustLevel;
}

export interface DispatchPlanAuthorization {
  actor_id: string;
  decision: "allow";
  reason_code: string;
}

export interface DispatchPlanBinding {
  execution_route_kind: ActionRouteKind;
  runtime_target?: RuntimeTarget;
}

export interface DispatchPlanAvailability {
  status: AvailabilityStatus | "not_applicable";
  target?: RuntimeTarget;
}

export interface DispatchPlanProvider {
  provider_id: string;
  score: number;
  fallback_provider_ids: string[];
}

export interface DispatchPlan {
  run_id: string;
  trace_id: string;
  status: "planned";
  capability: DispatchPlanCapability;
  authorization: DispatchPlanAuthorization;
  binding: DispatchPlanBinding;
  availability: DispatchPlanAvailability | null;
  provider: DispatchPlanProvider | null;
  evidence_refs: string[];
}
