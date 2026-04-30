import type { ProviderCapability } from "../../runtime-economics-contracts/src/provider.js";
import { filterProvidersByPolicy } from "./providerPolicy.js";
import { scoreProvider, type ProviderScoreResult } from "./providerScoring.js";

export interface ProviderSelectionResult {
  selected: ProviderCapability | null;
  rejected: Array<{ provider_id: string; score: number; reason: string }>;
  reasons: string[];
}

export function selectProvider(
  providers: ProviderCapability[],
  taskContext: {
    needs_tools?: boolean;
    needs_structured_output?: boolean;
    needs_reasoning?: boolean;
    needs_long_context?: boolean;
    privacy_requirement?: "local_only" | "restricted" | "external_safe";
    cost_preference?: "low" | "medium" | "high";
    local_only_required?: boolean;
    denied_providers?: string[];
  }
): ProviderSelectionResult {
  const filtered = filterProvidersByPolicy(providers, {
    local_only_required: taskContext.local_only_required,
    denied_providers: taskContext.denied_providers,
  });

  const scored = filtered.map((p) => scoreProvider(p, taskContext));
  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { selected: null, rejected: [], reasons: ["no_providers_available_after_filtering"] };
  }

  const selected = scored[0];
  const rejected = scored.slice(1).map((s) => ({ provider_id: s.provider_id, score: s.score, reason: `score:${s.score}` }));
  const reasons = [`selected:${selected.provider_id}`, `score:${selected.score}`, ...selected.reasons];

  return {
    selected: providers.find((p) => p.provider_id === selected.provider_id) ?? null,
    rejected,
    reasons,
  };
}
