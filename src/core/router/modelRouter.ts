// Model Router — Pack 3.3
// Main routing engine: selects provider/model/lane with explainable decisions

import type { ActorMode } from "../../types/authz.js";
import type { LaneId } from "./lanes.js";
import type { ProviderDescriptor } from "./providerRegistry.js";
import type { ModelDescriptor } from "./modelCatalog.js";
import type { RouterPolicy, PromptClass, BudgetClass, PrivacyPreference } from "./routerPolicy.js";
import {
  buildRouterPolicy,
  filterProvidersByPolicy,
  filterModelsByPolicy,
  determineLaneFromPolicy,
} from "./routerPolicy.js";
import { scoreCandidate, rankCandidates, type ScoredCandidate } from "./routerScoring.js";
import { buildDefaultProviderRegistry } from "./providerRegistry.js";
import { buildDefaultModelCatalog } from "./modelCatalog.js";
import { getCandidateLanesForMode, isLaneAllowedForMode } from "./lanes.js";
import { buildExplainForDecision } from "../trace/explainBuilder.js";
import type { RejectedOption, RouterExplain } from "../trace/traceTypes.js";

export interface RouterInput {
  actor_id: string;
  actor_mode: ActorMode;
  capabilities: string[];
  intent_key?: string;
  task_kind?: string;
  prompt_class?: PromptClass;
  privacy_preference?: PrivacyPreference;
  budget_class?: BudgetClass;
  requested_provider?: string;
  requested_model?: string;
  needs_tools?: boolean;
  needs_reasoning?: boolean;
  session_id?: string;
  trace_id?: string;
}

export interface FallbackEntry {
  provider_id: string;
  model_id: string;
  lane: LaneId;
  reason: string;
  score: number;
}

export interface RouterDecision {
  allowed: boolean;
  provider_id?: string;
  model_id?: string;
  lane?: LaneId;
  fallback_chain: FallbackEntry[];
  execution_hint: {
    reasoning_depth: "low" | "medium" | "high";
    tool_usage: "none" | "optional" | "expected";
    privacy_mode: "local" | "remote";
  };
  reason_code: string;
  explain: RouterExplain;
  decision_id: string;
  scored_candidates: ScoredCandidate[];
}

export class ModelRouter {
  private providers: ProviderDescriptor[];
  private models: ModelDescriptor[];

  constructor(
    providers?: ProviderDescriptor[],
    models?: ModelDescriptor[]
  ) {
    this.providers = providers ?? buildDefaultProviderRegistry();
    this.models = models ?? buildDefaultModelCatalog();
  }

  route(input: RouterInput): RouterDecision {
    const decisionId = `dec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Step 1 — Build policy
    const policy = buildRouterPolicy(input.actor_mode, {
      prompt_class: input.prompt_class,
      budget_class: input.budget_class,
      privacy_preference: input.privacy_preference,
      requested_provider: input.requested_provider,
      requested_model: input.requested_model,
      needs_tools: input.needs_tools,
      needs_reasoning: input.needs_reasoning,
    });

    // Step 2 — Determine candidate lanes
    const candidateLanes = getCandidateLanesForMode(input.actor_mode);
    if (candidateLanes.length === 0) {
      return this.rejectDecision(decisionId, input, policy, "NO_LANES_AVAILABLE", "No lanes available for this mode");
    }

    // Step 3 — Filter providers by policy
    let availableProviders = filterProvidersByPolicy(this.providers, policy);
    if (availableProviders.length === 0) {
      return this.rejectDecision(decisionId, input, policy, "NO_PROVIDERS_AVAILABLE", "No providers available for this policy");
    }

    // Step 4 — Filter models by policy
    let availableModels = filterModelsByPolicy(this.models, policy);
    if (availableModels.length === 0) {
      return this.rejectDecision(decisionId, input, policy, "NO_MODELS_AVAILABLE", "No models available for this policy");
    }

    // Step 5 — Determine primary lane
    const primaryLane = determineLaneFromPolicy(policy);

    // Step 6 — Score all candidates across all valid lane/provider/model combinations
    const candidates: ScoredCandidate[] = [];
    const rejectedOptions: RejectedOption[] = [];

    for (const lane of candidateLanes) {
      const laneProviders = availableProviders.filter((p) => p.lanes.includes(lane));
      const laneModels = availableModels.filter((m) => m.lane_fit.includes(lane));

      for (const provider of laneProviders) {
        for (const model of laneModels) {
          if (model.provider_id !== provider.provider_id) continue;

          const scored = scoreCandidate(provider, model, lane, policy);
          // Boost score for policy-determined lane
          if (lane === primaryLane) {
            scored.score += 20;
          }
          candidates.push(scored);
        }
      }
    }

    // Collect rejected options
    for (const lane of candidateLanes) {
      const laneProviders = availableProviders.filter((p) => !p.lanes.includes(lane));
      for (const provider of laneProviders) {
        rejectedOptions.push({
          kind: "provider" as const,
          id: provider.provider_id,
          reason_code: "LANE_MISMATCH",
          explain: [`provider ${provider.provider_id} does not support lane ${lane}`],
        });
      }
    }

    // Step 7 — Rank and select
    const ranked = rankCandidates(candidates);
    if (ranked.length === 0) {
      return this.rejectDecision(decisionId, input, policy, "NO_CANDIDATES_SCORED", "No candidates scored after filtering");
    }

    const primary = ranked[0];
    const fallbacks = ranked.slice(1, 4).map((c) => ({
      provider_id: c.provider_id,
      model_id: c.model_id,
      lane: c.lane,
      reason: `fallback score=${c.score}`,
      score: c.score,
    }));

    // Step 8 — Build explain
    const explain = buildExplainForDecision({
      decision_id: decisionId,
      decision_type: "router.model.select",
      actor_id: input.actor_id,
      actor_mode: input.actor_mode,
      selected: {
        lane: primary.lane,
        provider_id: primary.provider_id,
        model_id: primary.model_id,
      },
      rejected: rejectedOptions,
      policy_factors: {
        actor_mode: input.actor_mode,
        budget_class: policy.budget_class,
        privacy_preference: policy.privacy_preference,
        requested_provider: policy.requested_provider,
        requested_model: policy.requested_model,
        prompt_class: policy.prompt_class,
      },
      score: primary.score,
      fallback_count: fallbacks.length,
    });

    return {
      allowed: true,
      provider_id: primary.provider_id,
      model_id: primary.model_id,
      lane: primary.lane,
      fallback_chain: fallbacks,
      execution_hint: {
        reasoning_depth: primary.lane === "smart" || primary.lane === "creator" ? "high" : "low",
        tool_usage: policy.needs_tools ? "expected" : "none",
        privacy_mode: primary.provider_id === "local" ? "local" : "remote",
      },
      reason_code: "ROUTED_SUCCESSFULLY",
      explain,
      decision_id: decisionId,
      scored_candidates: ranked,
    };
  }

  private rejectDecision(
    decisionId: string,
    input: RouterInput,
    policy: RouterPolicy,
    reasonCode: string,
    message: string
  ): RouterDecision {
    const explain = buildExplainForDecision({
      decision_id: decisionId,
      decision_type: "router.reject",
      actor_id: input.actor_id,
      actor_mode: input.actor_mode,
      selected: null,
      rejected: [],
      policy_factors: {
        actor_mode: input.actor_mode,
        budget_class: policy.budget_class,
        privacy_preference: policy.privacy_preference,
        requested_provider: policy.requested_provider,
        requested_model: policy.requested_model,
        prompt_class: policy.prompt_class,
      },
      score: 0,
      fallback_count: 0,
      reject_reason: message,
    });

    return {
      allowed: false,
      fallback_chain: [],
      execution_hint: {
        reasoning_depth: "low",
        tool_usage: "none",
        privacy_mode: "remote",
      },
      reason_code: reasonCode,
      explain,
      decision_id: decisionId,
      scored_candidates: [],
    };
  }
}

export const defaultRouter = new ModelRouter();
