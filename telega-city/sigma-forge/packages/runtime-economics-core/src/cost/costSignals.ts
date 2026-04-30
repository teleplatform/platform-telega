import type { TaskInput } from "./taskComplexity.js";
import { classifyTaskComplexity } from "./taskComplexity.js";

export interface CostSignals {
  complexity: "low" | "medium" | "high";
  risk_level: "low" | "medium" | "high";
  latency_sensitivity: "low" | "medium" | "high";
  privacy_sensitivity: "low" | "medium" | "high";
  estimated_token_volume: "low" | "medium" | "high";
  needs_tools: boolean;
  needs_review: boolean;
}

export function buildCostSignals(input: TaskInput, context?: { privacy_sensitive?: boolean; latency_sensitive?: boolean }): CostSignals {
  const complexity = classifyTaskComplexity(input);
  const goal = input.goal.toLowerCase();

  const risk_level = goal.includes("payment") || goal.includes("order") || goal.includes("crm") ? "high" : complexity === "high" ? "medium" : "low";
  const latency_sensitivity = context?.latency_sensitive ? "high" : "low";
  const privacy_sensitivity = context?.privacy_sensitive ? "high" : risk_level === "high" ? "medium" : "low";
  const estimated_token_volume = complexity === "high" ? "high" : complexity === "medium" ? "medium" : "low";

  return {
    complexity,
    risk_level,
    latency_sensitivity,
    privacy_sensitivity,
    estimated_token_volume,
    needs_tools: input.requires_tools ?? false,
    needs_review: input.requires_review ?? false,
  };
}
