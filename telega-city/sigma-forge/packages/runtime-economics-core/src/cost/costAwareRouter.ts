import type { TaskInput } from "./taskComplexity.js";
import type { ExecutionRouteDecision, ExecutionMode } from "../../runtime-economics-contracts/src/routeDecision.js";
import { classifyTaskComplexity } from "./taskComplexity.js";
import { resolveExecutionMode } from "./orchestrationDepth.js";
import { buildCostSignals } from "./costSignals.js";
import { suggestCheaperMode } from "./cheaperMode.js";

export function routeTaskEconomically(input: TaskInput, context?: { privacy_sensitive?: boolean; latency_sensitive?: string }): ExecutionRouteDecision {
  const signals = buildCostSignals(input, context);
  const complexity = signals.complexity;
  const executionMode = resolveExecutionMode({
    complexity,
    needs_tools: signals.needs_tools,
    needs_review: signals.needs_review,
    needs_approval: input.requires_approval ?? false,
    risk_level: signals.risk_level,
  });

  const cheaperMode = suggestCheaperMode(executionMode);
  const reasons = [`complexity:${complexity}`, `risk:${signals.risk_level}`, `tools:${signals.needs_tools}`, `review:${signals.needs_review}`];

  return {
    task_id: input.task_id,
    execution_mode: executionMode,
    complexity,
    risk_level: signals.risk_level,
    latency_sensitivity: signals.latency_sensitivity,
    privacy_sensitivity: signals.privacy_sensitivity,
    estimated_token_volume: signals.estimated_token_volume,
    needs_tools: signals.needs_tools,
    needs_review: signals.needs_review,
    reasons,
    cheaper_mode_available: cheaperMode,
  };
}
