export type OptimizationIntentType =
  | "route_optimization"
  | "retry_optimization"
  | "fallback_optimization"
  | "verification_optimization"
  | "resource_preference_optimization"
  | "handoff_threshold_optimization"
  | "execution_sequence_optimization";

export type TrialStatus = "running" | "completed" | "aborted";
export type TrialDecision = "accept" | "reject" | "extend";
export type RolloutStage = "partial" | "expanded" | "full";
export type RolloutStatus = "running" | "completed" | "rolled_back";

export interface OptimizationCandidate {
  candidate_id: string;
  proposal_id: string;
  intent_type: OptimizationIntentType;
  target_type: string;
  target_id: string;
  proposed_params: Record<string, unknown>;
  created_at: string;
  created_by: string;
}

export interface OptimizationTrial {
  trial_id: string;
  candidate_id: string;
  scope: {
    percentage: number;
    segment?: string;
  };
  duration_ms: number;
  started_at: string;
  status: TrialStatus;
}

export interface OptimizationMetrics {
  metric_id: string;
  trial_id: string;
  baseline: Record<string, number>;
  candidate: Record<string, number>;
  recorded_at: string;
}

export interface OptimizationEvaluation {
  evaluation_id: string;
  candidate_id: string;
  trial_id: string;
  improvement: boolean;
  regression: boolean;
  metrics_diff: Record<string, number>;
  decision: TrialDecision;
  evaluated_at: string;
}

export interface OptimizationRollout {
  rollout_id: string;
  candidate_id: string;
  stage: RolloutStage;
  started_at: string;
  status: RolloutStatus;
}

export interface OptimizationRollback {
  rollback_id: string;
  rollout_id: string;
  candidate_id: string;
  reason: string;
  created_at: string;
}

export interface OptimizationAuditEvent {
  event_type: string;
  actor: string;
  details: Record<string, unknown>;
  timestamp: string;
}
