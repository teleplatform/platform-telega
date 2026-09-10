/**
 * @tele-gpt/dispatcher-core — Routing Dry-Run / Explain (Phase 6B)
 *
 * A deterministic, side-effect-free SIMULATOR. Given a hypothetical input it
 * evaluates the current RoutingRegistry rules in canonical order
 * (priority DESC, then id ASC) and reports which rule WOULD match and what the
 * configured action WOULD be.
 *
 * Explicit non-goals (important — do not erode these):
 *   - Never consults provider health, capability registry, availability, cost
 *     or model compatibility data. `routeTo`/`fallback` are CONFIGURATION only
 *     and must not be read as proof the target is healthy or reachable.
 *   - Never mutates anything: no writes, no provider calls, no runtime starts,
 *     no health/cost updates.
 *   - Independent of src/core/router.ts and provider-selection-orchestrator.
 *
 * Evaluation semantics:
 *   - Rules are evaluated in canonical order (priority DESC, id ASC).
 *   - A disabled rule is reported but never matches.
 *   - A rule matches when EVERY present condition field passes.
 *   - An enabled rule with an empty condition ("{}") is a catch-all: it always
 *     matches and acts as a deterministic default route.
 *   - FIRST enabled matching rule in canonical order wins.
 *   - Same input → byte-identical output.
 */

import type {
  RoutingCondition,
  RoutingExplainInput,
  RoutingExplainReason,
  RoutingExplainResult,
  RoutingExplainRuleEval,
  RoutingExplainWinner,
  RoutingExplainOutcome,
  RoutingExplainer,
  RoutingRegistry,
  RoutingRule,
} from "./types.js";

function canonicalOrder(a: RoutingRule, b: RoutingRule): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.id.localeCompare(b.id);
}

interface FieldCheck {
  field: string;
  passed: boolean;
  expected?: string | number;
  observed?: string | number;
  message: string;
}

function checkEquality(
  field: string,
  required: string,
  actual: string | undefined,
): FieldCheck {
  return {
    field,
    passed: actual === required,
    expected: required,
    observed: actual,
    message:
      actual === required
        ? `condition.${field} matches`
        : `condition.${field} requires "${required}"${actual === undefined ? ", input did not provide it" : `, got "${actual}"`}`,
  };
}

function checkMaxConstraint(
  field: string,
  max: number,
  observed: number | undefined,
  unit: string,
): FieldCheck {
  if (observed === undefined) {
    return {
      field,
      passed: false,
      expected: `<= ${max} ${unit}`,
      message: `condition.${field} requires <= ${max} ${unit}, input did not provide it`,
    };
  }
  const passed = observed <= max;
  return {
    field,
    passed,
    expected: `<= ${max} ${unit}`,
    observed: `${observed} ${unit}`,
    message: passed
      ? `condition.${field} satisfied`
      : `condition.${field} requires <= ${max} ${unit}, got ${observed}`,
  };
}

/**
 * Evaluate a single rule's condition against the input. Produces one
 * machine-readable reason per PRESENT condition field, in a fixed document
 * order, so output is deterministic.
 */
export function evaluateRuleCondition(
  condition: RoutingCondition,
  input: RoutingExplainInput,
): RoutingExplainReason[] {
  const reasons: FieldCheck[] = [];

  if (condition.capability !== undefined) {
    reasons.push(checkEquality("capability", condition.capability, input.capability));
  }
  if (condition.modelFamily !== undefined) {
    reasons.push(checkEquality("modelFamily", condition.modelFamily, input.modelFamily));
  }
  if (condition.runtimeKind !== undefined) {
    reasons.push(
      checkEquality("runtimeKind", condition.runtimeKind, input.runtimeKind),
    );
  }
  if (condition.providerKind !== undefined) {
    reasons.push(
      checkEquality("providerKind", condition.providerKind, input.providerKind),
    );
  }
  if (condition.maxLatencyMs !== undefined) {
    reasons.push(
      checkMaxConstraint("maxLatencyMs", condition.maxLatencyMs, input.latencyMs, "ms"),
    );
  }
  if (condition.maxCostPerToken !== undefined) {
    reasons.push(
      checkMaxConstraint(
        "maxCostPerToken",
        condition.maxCostPerToken,
        input.costPerToken,
        "USD/token",
      ),
    );
  }
  if (condition.userRole !== undefined) {
    reasons.push(checkEquality("userRole", condition.userRole, input.userRole));
  }

  return reasons;
}

/**
 * Pure evaluation: sorts a copy of the rules into canonical order and returns
 * the full explain result. Never mutates its inputs.
 */
export function evaluateRoutingRules(
  rules: RoutingRule[],
  input: RoutingExplainInput,
): RoutingExplainResult {
  const ordered = [...rules].sort(canonicalOrder);

  const evaluated: RoutingExplainRuleEval[] = [];
  let winner: RoutingExplainWinner | undefined;
  let outcome: RoutingExplainOutcome = "no_match";

  for (const rule of ordered) {
    if (!rule.enabled) {
      evaluated.push({
        ruleId: rule.id,
        ruleName: rule.name,
        enabled: false,
        matched: false,
        reasons: [
          {
            field: "enabled",
            passed: false,
            message: "rule is disabled and is never eligible to win",
          },
        ],
      });
      continue;
    }

    const reasons = evaluateRuleCondition(rule.condition, input);
    const matched = reasons.every((r) => r.passed);
    evaluated.push({
      ruleId: rule.id,
      ruleName: rule.name,
      enabled: true,
      matched,
      reasons,
    });

    if (matched && winner === undefined) {
      winner = {
        ruleId: rule.id,
        ruleName: rule.name,
        routeTo: rule.action.routeTo,
        fallback: rule.action.fallback,
        weight: rule.action.weight,
      };
      outcome = "matched";
    }
  }

  const result: RoutingExplainResult = {
    input,
    rules: evaluated,
    outcome,
  };
  if (winner) result.winner = winner;
  return result;
}

/**
 * Read-only application service bound to a registry: reads rules via list()
 * (already canonical) and evaluates them.
 */
export function createRoutingExplainer(
  registry: RoutingRegistry,
): RoutingExplainer {
  return {
    explain(input) {
      return evaluateRoutingRules(registry.list(), input);
    },
  };
}