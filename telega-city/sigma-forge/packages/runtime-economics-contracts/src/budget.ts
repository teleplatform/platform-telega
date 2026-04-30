export interface ExecutionBudget {
  max_tokens_per_task: number;
  max_tools_per_task: number;
  max_retries: number;
  max_fanout: number;
  max_agent_chain_depth: number;
  max_total_cost_estimate: number;
}

export interface BudgetDecision {
  allowed: boolean;
  reasons: string[];
  estimated_cost?: number;
  estimated_tokens?: number;
  cheaper_mode_recommended?: string;
}
