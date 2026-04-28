// Explain Builder — Pack 3.4
// Builds standardized explain payloads for router decisions

import type { ActorMode } from "../../types/authz.js";
import type { LaneId } from "../router/lanes.js";
import type {
  RouterExplain,
  RejectedOption,
  DecisionType,
} from "./traceTypes.js";
import type { PromptClass, BudgetClass, PrivacyPreference } from "../router/routerPolicy.js";

export interface ExplainInput {
  decision_id: string;
  decision_type: DecisionType;
  actor_id: string;
  actor_mode: ActorMode;
  selected: {
    lane?: LaneId;
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
}

export function buildExplainForDecision(input: ExplainInput): RouterExplain {
  const explain: string[] = [];

  if (input.selected) {
    explain.push(`selected lane=${input.selected.lane ?? "N/A"}`);
    explain.push(`selected provider=${input.selected.provider_id ?? "N/A"}`);
    explain.push(`selected model=${input.selected.model_id ?? "N/A"}`);
  }

  explain.push(`actor_mode=${input.actor_mode}`);
  if (input.policy_factors.budget_class) {
    explain.push(`budget_class=${input.policy_factors.budget_class}`);
  }
  if (input.policy_factors.privacy_preference) {
    explain.push(`privacy=${input.policy_factors.privacy_preference}`);
  }
  if (input.policy_factors.prompt_class) {
    explain.push(`prompt_class=${input.policy_factors.prompt_class}`);
  }
  if (input.policy_factors.requested_provider) {
    explain.push(`requested_provider=${input.policy_factors.requested_provider} (hint only)`);
  }
  if (input.policy_factors.requested_model) {
    explain.push(`requested_model=${input.policy_factors.requested_model} (hint only)`);
  }
  if (input.score !== undefined) {
    explain.push(`score=${input.score}`);
  }
  if (input.fallback_count !== undefined && input.fallback_count > 0) {
    explain.push(`fallback_chain_size=${input.fallback_count}`);
  }

  if (input.rejected.length > 0) {
    explain.push(`rejected_alternatives=${input.rejected.length}`);
  }

  if (input.reject_reason) {
    explain.push(`reject_reason=${input.reject_reason}`);
  }

  const decisionSummary = input.selected
    ? `routed to ${input.selected.provider_id}:${input.selected.model_id} via lane ${input.selected.lane}`
    : `routing rejected: ${input.reject_reason ?? "no valid route"}`;

  return {
    decision_id: input.decision_id,
    decision_type: input.decision_type,
    decision_summary: decisionSummary,
    reason_code: input.selected ? "ROUTED_SUCCESSFULLY" : "ROUTING_REJECTED",
    explain,
    selected: input.selected,
    rejected: input.rejected,
    policy_factors: input.policy_factors,
    score: input.score,
    fallback_count: input.fallback_count,
    reject_reason: input.reject_reason,
    timestamp: new Date().toISOString(),
  };
}

export function buildFallbackExplain(
  decisionId: string,
  failedProvider: string,
  failedModel: string,
  fallbackProvider: string,
  fallbackModel: string,
  reason: string
): RouterExplain {
  return {
    decision_id: `${decisionId}_fallback`,
    decision_type: "router.fallback",
    decision_summary: `fallback from ${failedProvider}:${failedModel} to ${fallbackProvider}:${fallbackModel}`,
    reason_code: "FALLBACK_ACTIVATED",
    explain: [
      `primary failed: ${failedProvider}:${failedModel}`,
      `fallback activated: ${fallbackProvider}:${fallbackModel}`,
      `reason: ${reason}`,
    ],
    selected: {
      provider_id: fallbackProvider,
      model_id: fallbackModel,
    },
    rejected: [
      {
        kind: "provider",
        id: failedProvider,
        reason_code: "EXECUTION_FAILED",
        explain: [`primary provider failed: ${reason}`],
      },
    ],
    policy_factors: {
      actor_mode: "system",
    },
    timestamp: new Date().toISOString(),
  };
}
