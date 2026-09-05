import { Policy, PolicyContext, PolicyEvaluation, PolicyResult, PolicyRule } from "./policyTypes";
import { PolicyRegistry } from "./policyRegistry";

function evaluateCondition(context: PolicyContext, rule: PolicyRule): boolean {
  return rule.conditions.every((cond) => {
    const contextValue = (context as any)[cond.field];

    switch (cond.operator) {
      case "eq":
        return contextValue === cond.value;
      case "neq":
        return contextValue !== cond.value;
      case "gt":
        return typeof contextValue === "number" && typeof cond.value === "number" && contextValue > cond.value;
      case "gte":
        return typeof contextValue === "number" && typeof cond.value === "number" && contextValue >= cond.value;
      case "lt":
        return typeof contextValue === "number" && typeof cond.value === "number" && contextValue < cond.value;
      case "lte":
        return typeof contextValue === "number" && typeof cond.value === "number" && contextValue <= cond.value;
      case "in":
        return Array.isArray(cond.value) && cond.value.includes(contextValue);
      case "not_in":
        return Array.isArray(cond.value) && !cond.value.includes(contextValue);
      case "contains":
        return typeof contextValue === "string" && typeof cond.value === "string" && contextValue.includes(cond.value as string);
      case "matches":
        return typeof contextValue === "string" && typeof cond.value === "string" && new RegExp(cond.value as string).test(contextValue);
      default:
        return false;
    }
  });
}

export function evaluatePolicy(context: PolicyContext): PolicyResult {
  const evaluations: PolicyEvaluation[] = [];
  let finalEffect: "allow" | "deny" | "require_approval" = "allow";

  // Collect all applicable policies sorted by scope priority
  const allPolicies = PolicyRegistry.getAll()
    .filter((p) => p.enabled)
    .sort((a, b) => {
      const scopeOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (scopeOrder[a.severity] ?? 99) - (scopeOrder[b.severity] ?? 99);
    });

  for (const policy of allPolicies) {
    // Sort rules by priority
    const sortedRules = [...policy.rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (evaluateCondition(context, rule)) {
        evaluations.push({
          policyId: policy.policyId,
          policyName: policy.name,
          effect: rule.effect,
          matchedRule: rule.name,
          reason: rule.reason,
          timestamp: Date.now(),
        });

        // Apply effect: deny overrides allow, require_approval overrides allow
        if (rule.effect === "deny") {
          finalEffect = "deny";
        } else if (rule.effect === "require_approval" && finalEffect !== "deny") {
          finalEffect = "require_approval";
        }
      }
    }
  }

  // If no policy matched, default is allow
  if (evaluations.length === 0) {
    evaluations.push({
      policyId: "default",
      policyName: "Default Allow",
      effect: "allow",
      matchedRule: null,
      reason: "No matching policy rules",
      timestamp: Date.now(),
    });
  }

  return {
    allowed: finalEffect === "allow",
    requiresApproval: finalEffect === "require_approval",
    evaluations,
    summary: finalEffect === "allow"
      ? "All policy checks passed"
      : finalEffect === "deny"
      ? "Blocked by policy"
      : "Requires human approval",
  };
}
