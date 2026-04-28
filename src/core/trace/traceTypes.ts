// Trace Types — Pack 3.4
// Canonical types for decision traces and explain payloads

import type { ActorMode } from "../../types/authz.js";
import type { LaneId } from "../router/lanes.js";
import type { PromptClass, BudgetClass, PrivacyPreference } from "../router/routerPolicy.js";

export type DecisionType =
  | "router.lane.select"
  | "router.provider.select"
  | "router.model.select"
  | "router.fallback"
  | "router.execution.failed"
  | "router.execution.recovered"
  | "router.reject";

export interface RejectedOption {
  kind: "lane" | "provider" | "model";
  id: string;
  reason_code: string;
  explain: string[];
}

export interface RouterExplain {
  decision_id: string;
  decision_type: DecisionType;
  decision_summary: string;
  reason_code: string;
  explain: string[];
  selected: {
    lane?: string;
    provider_id?: string;
    model_id?: string;
  } | null;
  rejected: RejectedOption[];
  policy_factors: {
    actor_mode: ActorMode;
    budget_class?: BudgetClass;
    privacy_preference?: PrivacyPreference;
    requested_provider?: string;
    requested_model?: string;
    prompt_class?: PromptClass;
  };
  score?: number;
  fallback_count?: number;
  reject_reason?: string;
  timestamp: string;
}

export interface DecisionTrace {
  trace_id: string;
  decision_id: string;
  decision_type: DecisionType;
  session_id?: string;
  actor_id?: string;
  actor_mode?: ActorMode;
  timestamp: string;
  reason_code: string;
  explain: string[];
  selected_option?: string;
  rejected_options?: RejectedOption[];
  input_factors: Record<string, unknown>;
}
