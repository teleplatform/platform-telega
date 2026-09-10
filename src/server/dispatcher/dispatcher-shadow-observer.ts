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