import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { ProviderRegistry } from "./provider-registry.js";
import { ProviderPolicy } from "./provider-policy.js";
import { ProviderScore } from "./provider-score.js";
import type { ProviderProfile } from "./provider-profile.js";
import type { ProviderRouteRequest, ProviderDecision, BlockedProvider } from "./provider-decision.js";
import type { ProviderAccessTier } from "./provider.types.js";

export { ProviderRegistry } from "./provider-registry.js";
export { ProviderPolicy } from "./provider-policy.js";
export { ProviderScore } from "./provider-score.js";
export type { ProviderProfile } from "./provider-profile.js";
export type { ProviderRouteRequest, ProviderDecision, BlockedProvider } from "./provider-decision.js";

const FALLBACK_COUNT = 2;

export class ProviderRouterV2 {
  readonly registry: ProviderRegistry;
  readonly policy: ProviderPolicy;
  readonly scorer: ProviderScore;

  constructor(registry: ProviderRegistry) {
    this.registry = registry;
    this.policy = new ProviderPolicy();
    this.scorer = new ProviderScore();
  }

  async select(request: ProviderRouteRequest, activeTier?: ProviderAccessTier, activeProviderId?: string): Promise<ProviderDecision> {
    const candidates = this.registry.listEnabled();
    let filtered = candidates;

    if (activeTier) {
      filtered = candidates.filter((p) => p.access_tier === activeTier);
    }

    if (activeProviderId) {
      filtered = candidates.filter((p) => p.provider_id === activeProviderId);
    }

    if (filtered.length === 0 && activeTier) {
      filtered = candidates.filter((p) => p.access_tier === activeTier);
    }

    const scored: Array<{ profile: ProviderProfile; score: number }> = [];
    const blocked: BlockedProvider[] = [];

    for (const profile of filtered) {
      const check = this.policy.check(profile, request);
      if (check.blocked) {
        blocked.push({ provider_id: profile.provider_id, reason: check.reason! });
        continue;
      }

      const score = this.scorer.score(profile, request);
      scored.push({ profile, score });
    }

    scored.sort((a, b) => b.score - a.score);

    await appendEvidenceRecord({
      evidence_id: hashTraceId(request.run_id, "provider_candidates_scored"),
      trace_id: request.trace_id,
      job_id: "provider",
      type: "provider_candidates_scored" as any,
      timestamp: new Date().toISOString(),
      payload: {
        run_id: request.run_id,
        active_tier: activeTier,
        active_provider: activeProviderId,
        candidates: scored.map((s) => ({ provider_id: s.profile.provider_id, score: s.score })),
        blocked: blocked.map((b) => ({ provider_id: b.provider_id, reason: b.reason })),
      },
    });

    if (scored.length === 0) {
      const fallbackCandidates = activeTier
        ? candidates.filter((p) => p.access_tier === activeTier)
        : candidates;

      const fallbackBlocked: BlockedProvider[] = [];
      const fallbackScored: Array<{ profile: ProviderProfile; score: number }> = [];

      for (const profile of fallbackCandidates) {
        const check = this.policy.check(profile, request);
        if (check.blocked) {
          fallbackBlocked.push({ provider_id: profile.provider_id, reason: check.reason! });
          continue;
        }
        const score = this.scorer.score(profile, request);
        fallbackScored.push({ profile, score });
      }

      fallbackScored.sort((a, b) => b.score - a.score);

      if (fallbackScored.length > 0) {
        const chosen = fallbackScored[0];
        const fallbacks = fallbackScored.slice(1, 1 + FALLBACK_COUNT).map((s) => s.profile.provider_id);

        const decision: ProviderDecision = {
          provider_id: chosen.profile.provider_id,
          capability_id: "capability.provider_bridge.api",
          reason: `${chosen.profile.display_name} selected (fallback within tier, score: ${chosen.score})`,
          score: chosen.score,
          fallback_provider_ids: fallbacks,
          blocked_providers: [...blocked, ...fallbackBlocked],
        };

        await appendEvidenceRecord({
          evidence_id: hashTraceId(request.run_id, "provider_decision_created"),
          trace_id: request.trace_id,
          job_id: "provider",
          type: "provider_decision_created" as any,
          timestamp: new Date().toISOString(),
          payload: {
            run_id: request.run_id,
            provider_id: decision.provider_id,
            score: decision.score,
            fallbacks: decision.fallback_provider_ids,
            reason: decision.reason,
            fallback_triggered: true,
          },
        });

        return decision;
      }

      const decision: ProviderDecision = {
        provider_id: "none",
        capability_id: "capability.provider_bridge.api",
        reason: `No suitable provider found in tier: ${activeTier ?? "all"}`,
        score: 0,
        fallback_provider_ids: [],
        blocked_providers: [...blocked, ...fallbackBlocked],
      };

      await appendEvidenceRecord({
        evidence_id: hashTraceId(request.run_id, "provider_decision_created"),
        trace_id: request.trace_id,
        job_id: "provider",
        type: "provider_decision_created" as any,
        timestamp: new Date().toISOString(),
        payload: { run_id: request.run_id, provider_id: "none", reason: `No suitable provider found in tier: ${activeTier ?? "all"}` },
      });

      return decision;
    }

    const chosen = scored[0];
    const fallbacks = scored.slice(1, 1 + FALLBACK_COUNT).map((s) => s.profile.provider_id);

    const decision: ProviderDecision = {
      provider_id: chosen.profile.provider_id,
      capability_id: "capability.provider_bridge.api",
      reason: `${chosen.profile.display_name} selected (score: ${chosen.score}) for ${request.task_kind} task`,
      score: chosen.score,
      fallback_provider_ids: fallbacks,
      blocked_providers: blocked,
    };

    await appendEvidenceRecord({
      evidence_id: hashTraceId(request.run_id, "provider_decision_created"),
      trace_id: request.trace_id,
      job_id: "provider",
      type: "provider_decision_created" as any,
      timestamp: new Date().toISOString(),
      payload: {
        run_id: request.run_id,
        provider_id: decision.provider_id,
        score: decision.score,
        fallbacks: decision.fallback_provider_ids,
        reason: decision.reason,
        active_tier: activeTier,
        active_provider: activeProviderId,
      },
    });

    return decision;
  }
}
