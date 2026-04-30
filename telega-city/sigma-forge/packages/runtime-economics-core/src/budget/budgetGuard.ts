import type { ExecutionBudget, BudgetDecision } from "../../runtime-economics-contracts/src/budget.js";

export interface BudgetCheckInput {
  task_id?: string;
  estimated_tokens?: number;
  estimated_cost?: number;
  expected_tools?: number;
  expected_retries?: number;
  expected_fanout?: number;
  expected_chain_depth?: number;
}

export function estimateExecutionBudget(input: BudgetCheckInput, routeDecision: { complexity?: string; execution_mode?: string }, providerSelection: { cost_tier?: string }): { estimated_tokens: number; estimated_cost: number } {
  const complexityMultiplier = routeDecision.complexity === "high" ? 3 : routeDecision.complexity === "medium" ? 2 : 1;
  const modeMultiplier = routeDecision.execution_mode === "multi_agent_reviewed" ? 4 : routeDecision.execution_mode === "multi_agent" ? 3 : routeDecision.execution_mode === "tool_augmented" ? 2 : 1;
  const baseTokens = 5000;
  const estimated_tokens = baseTokens * complexityMultiplier * modeMultiplier;
  const costPerToken = providerSelection.cost_tier === "high" ? 0.00005 : providerSelection.cost_tier === "medium" ? 0.00002 : 0.00001;
  const estimated_cost = estimated_tokens * costPerToken;
  return { estimated_tokens, estimated_cost };
}

export function checkExecutionBudget(input: BudgetCheckInput, budget: ExecutionBudget): BudgetDecision {
  const reasons: string[] = [];

  if (input.estimated_tokens && input.estimated_tokens > budget.max_tokens_per_task) {
    reasons.push(`tokens_exceeded: ${input.estimated_tokens} > ${budget.max_tokens_per_task}`);
  }
  if (input.estimated_cost && input.estimated_cost > budget.max_total_cost_estimate) {
    reasons.push(`cost_exceeded: ${input.estimated_cost} > ${budget.max_total_cost_estimate}`);
  }
  if (input.expected_tools && input.expected_tools > budget.max_tools_per_task) {
    reasons.push(`tools_exceeded: ${input.expected_tools} > ${budget.max_tools_per_task}`);
  }
  if (input.expected_retries && input.expected_retries > budget.max_retries) {
    reasons.push(`retries_exceeded: ${input.expected_retries} > ${budget.max_retries}`);
  }
  if (input.expected_fanout && input.expected_fanout > budget.max_fanout) {
    reasons.push(`fanout_exceeded: ${input.expected_fanout} > ${budget.max_fanout}`);
  }
  if (input.expected_chain_depth && input.expected_chain_depth > budget.max_agent_chain_depth) {
    reasons.push(`chain_depth_exceeded: ${input.expected_chain_depth} > ${budget.max_agent_chain_depth}`);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    estimated_cost: input.estimated_cost,
    estimated_tokens: input.estimated_tokens,
  };
}

export function buildBudgetDecisionSummary(decision: BudgetDecision): string {
  if (decision.allowed) return "Budget check passed";
  return `Budget check failed: ${decision.reasons.join("; ")}`;
}
