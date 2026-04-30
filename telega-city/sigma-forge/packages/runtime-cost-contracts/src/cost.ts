export type MissionCostClass = 'tiny' | 'small' | 'medium' | 'large' | 'critical';
export type BusinessValue = 'low' | 'medium' | 'high' | 'strategic';
export type CostVerdict = 'allow' | 'allow_with_audit' | 'require_confirmation' | 'soft_block' | 'deny' | 'escalate';
export type CostSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CostEnvelope {
  cost_eval_id: string;
  mission_id: string;
  run_id?: string | null;
  action_id?: string | null;
  department_id?: string | null;
  mission_type: string;
  provider_name?: string | null;
  tool_name?: string | null;
  route_key?: string | null;
  orchestration_depth: number;
  estimated_tokens_in?: number | null;
  estimated_tokens_out?: number | null;
  estimated_tool_calls?: number | null;
  estimated_cost_usd: number;
  budget_profile?: string | null;
  mission_cost_class: MissionCostClass;
  expected_business_value: BusinessValue;
  user_visible: boolean;
  created_at: string;
}

export interface CostDecision {
  decision_id: string;
  cost_eval_id: string;
  verdict: CostVerdict;
  severity: CostSeverity;
  reason_codes: string[];
  policy_refs: string[];
  estimated_cost_usd: number;
  approved_cost_threshold_usd?: number | null;
  explanation: string;
  decided_at: string;
}

export interface MissionCostProfile {
  profile_id: string;
  mission_type: string;
  department_id?: string | null;
  max_auto_cost_usd: number;
  confirmation_cost_usd: number;
  hard_cap_cost_usd: number;
  max_orchestration_depth: number;
  require_confirmation_if_user_visible: boolean;
  default_business_value: BusinessValue;
  created_at: string;
  updated_at: string;
}

export interface BranchCostEstimate {
  estimate_id: string;
  mission_id: string;
  run_id?: string | null;
  route_key?: string | null;
  estimated_cost_usd: number;
  estimated_tokens_in?: number | null;
  estimated_tokens_out?: number | null;
  estimated_tool_calls?: number | null;
  orchestration_depth: number;
  estimated_latency_ms?: number | null;
  created_at: string;
}

export const COST_REASON_CATALOG: Record<string, string> = {
  COST_THRESHOLD_EXCEEDED: 'Estimated cost exceeds auto-allow threshold',
  ORCHESTRATION_DEPTH_EXCEEDED: 'Orchestration depth exceeds mission profile limit',
  LOW_VALUE_HIGH_COST_BRANCH: 'Low-value mission should not enter high-cost branch silently',
  USER_VISIBLE_COST_CONFIRMATION_REQUIRED: 'User-visible expensive branch requires confirmation',
  HARD_CAP_EXCEEDED: 'Estimated cost exceeds hard cap',
  MISSING_COST_PROFILE: 'No mission cost profile was found',
  BUDGET_PROFILE_MISMATCH: 'Budget profile does not match allowed mission economics',
  UNBOUNDED_TOOL_BRANCH: 'Tool branch appears unbounded or weakly constrained',
  STRATEGIC_MISSION_EXCEPTION: 'Strategic mission may justify escalation above standard thresholds',
  INSUFFICIENT_COST_CONTEXT: 'Insufficient context for reliable cost evaluation',
};
