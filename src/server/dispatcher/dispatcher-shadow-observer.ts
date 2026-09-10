import {
  evaluateRoutingRules,
} from "@tele-gpt/dispatcher-core";
import type {
  RoutingExplainInput,
  RoutingRegistry,
} from "@tele-gpt/dispatcher-core";
import type {
  DispatcherOverride,
  DispatcherRoutingFacts,
  DispatcherRoutingObserver,
} from "../../core/provider-selection-orchestrator.js";
import type { ProviderId } from "../../core/provider-resolution.js";
import {
  applyPolicyHintToRanking,
  POLICY_HINT_BONUS,
} from "../../core/policy-hint.js";
import type {
  PolicyAdjustedRanking,
  PolicyHint,
} from "../../core/policy-hint.js";
import {
  appendAuditEvent,
} from "../../runtime/audit/audit-store.js";
import { isDispatcherShadowEnabled } from "./dispatcher-mode.js";

export interface DispatcherShadowObserverOptions {
  routing: RoutingRegistry;
}

let decisionSeq = 0;

function nextDecisionId(): string {
  decisionSeq++;
  return `dispatcher_shadow_${Date.now()}_${decisionSeq}`;
}

type Divergence =
  | { kind: "agree"; actualValue?: string; dispatcherValue?: string }
  | { kind: "different_target"; actualValue?: string; dispatcherValue?: string }
  | { kind: "no_match"; actualValue?: string; dispatcherValue?: string }
  | { kind: "both_reject"; actualValue?: string; dispatcherValue?: string };

function resolveDivergence(
  outcome: "matched" | "no_match",
  actual: string | undefined,
  dispatcher: string | undefined,
): Divergence {
  if (outcome === "no_match") {
    return actual === undefined
      ? { kind: "both_reject", actualValue: actual, dispatcherValue: dispatcher }
      : { kind: "no_match", actualValue: actual, dispatcherValue: dispatcher };
  }
  if (actual === dispatcher) {
    return { kind: "agree", actualValue: actual, dispatcherValue: dispatcher };
  }
  return { kind: "different_target", actualValue: actual, dispatcherValue: dispatcher };
}

/**
 * Phase 6C.3A — derive hypothetical policy evidence from the exact base
 * ranking that production used for actual selection. Evidence only; never
 * feeds back into the production plan.
 */
function buildPolicyEvidence(
  facts: DispatcherRoutingFacts,
  hint: PolicyHint,
  adjusted: PolicyAdjustedRanking,
): Record<string, unknown> {
  const actualProvider = facts.selectedProviderId;
  const hypotheticalProvider = adjusted.ranked[0]?.providerId;
  const preferredEntry = adjusted.ranked.find(
    (e) => e.providerId === hint.preferredProviderId,
  );

  const baseWinnerProvider = facts.rankedProviders[0]?.providerId;
  const baseWinnerScore = facts.rankedProviders[0]?.score ?? null;

  const decisionChanged = hypotheticalProvider !== actualProvider;
  const rankingChanged = hypotheticalProvider !== baseWinnerProvider;
  const preferenceDefeated =
    adjusted.hintApplied && hypotheticalProvider !== hint.preferredProviderId;

  return {
    hint_applied: adjusted.hintApplied,
    preferred_provider_id: hint.preferredProviderId,
    strength: hint.strength,
    rule_id: hint.ruleId,
    rule_name: hint.ruleName ?? null,
    actual_provider: actualProvider,
    hypothetical_provider: hypotheticalProvider,
    base_score: preferredEntry?.baseScore ?? null,
    policy_bonus: preferredEntry ? POLICY_HINT_BONUS[hint.strength] ?? 0 : 0,
    adjusted_score: preferredEntry?.adjustedScore ?? null,
    base_rank: preferredEntry?.baseRank ?? null,
    adjusted_rank: preferredEntry?.adjustedRank ?? null,
    base_winner_provider: baseWinnerProvider,
    base_winner_score: baseWinnerScore,
    base_score_gap: preferredEntry ? (baseWinnerScore ?? 0) - preferredEntry.baseScore : null,
    decision_changed: decisionChanged,
    ranking_changed: rankingChanged,
    preference_defeated: preferenceDefeated,
    eligible_provider_count: facts.rankedProviders.length,
  };
}

export function createDispatcherShadowObserver(
  opts: DispatcherShadowObserverOptions,
): DispatcherRoutingObserver {
  return {
    observe(facts: DispatcherRoutingFacts): DispatcherOverride {
      if (!isDispatcherShadowEnabled()) {
        return { kind: "none" };
      }

      const decisionId = nextDecisionId();
      try {
        const input: RoutingExplainInput = {
          capability: facts.requiredCapabilities[0],
          modelFamily: facts.intent.requestedProviderFamily,
        };

        const result = evaluateRoutingRules(opts.routing.list(), input);
        const winner = result.winner;
        const dispatcherTarget = winner?.routeTo;
        const actual = facts.selectedProviderId;
        const matchedRuleCount = result.rules.filter((r) => r.matched).length;
        const gotWin = result.outcome === "matched";
        const converged = gotWin && actual === dispatcherTarget;
        const divergence = resolveDivergence(result.outcome, actual, dispatcherTarget);

        // Phase 6C.3A — hypothetical soft-policy influence (evidence only).
        let policy: Record<string, unknown> | null = null;
        if (gotWin && winner && dispatcherTarget) {
          const hint: PolicyHint = {
            preferredProviderId: dispatcherTarget as ProviderId,
            strength: "low",
            ruleId: winner.ruleId,
            ruleName: winner.ruleName,
          };
          const adjusted = applyPolicyHintToRanking(facts.rankedProviders, hint);
          policy = buildPolicyEvidence(facts, hint, adjusted);
        }

        appendAuditEvent({
          kind: "routing.dispatcher.shadow_decision",
          severity: "info",
          timestamp: new Date().toISOString(),
          traceId: facts.requestId ?? "dispatcher_shadow",
          source: "dispatcher.shadow.observer",
          actor: "dispatcher",
          summary: `Dispatcher shadow ${divergence.kind}: winner=${winner?.ruleId ?? "none"}`,
          payload: {
            decision_id: decisionId,
            mode: "shadow",
            input,
            actual: { provider_id: actual, model_id: facts.selectedModel },
            dispatcher: {
              outcome: result.outcome,
              winner_rule_id: winner?.ruleId,
              route_to: dispatcherTarget,
              fallback: winner?.fallback,
              weight: winner?.weight,
              matched_rule_count: matchedRuleCount,
            },
            converged,
            divergence,
            policy,
            timestamp: facts.timestamp,
          },
        });
      } catch (error) {
        try {
          appendAuditEvent({
            kind: "routing.dispatcher.error",
            severity: "high",
            timestamp: new Date().toISOString(),
            traceId: facts.requestId ?? "dispatcher_shadow",
            source: "dispatcher.shadow.observer",
            actor: "dispatcher",
            summary: "Dispatcher shadow evaluation failed",
            payload: {
              decision_id: decisionId,
              mode: "shadow",
              error: String((error as Error)?.message ?? error),
            },
          });
        } catch {
          // audit is best-effort; routing is already decided
        }
      }

      return { kind: "none" };
    },
  };
}