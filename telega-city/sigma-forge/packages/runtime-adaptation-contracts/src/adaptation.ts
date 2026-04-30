export type ProposalType =
  | "route_priority_adjustment"
  | "transport_preference_adjustment"
  | "fallback_preference_adjustment"
  | "reliability_score_update"
  | "manual_takeover_threshold"
  | "tool_chain_stability_flag"
  | "verification_step_addition"
  | "recovery_rule_refinement";

export type TargetType = "route" | "transport" | "tool" | "recovery_rule" | "verification_rule";
export type ProposalRiskClass = "low" | "medium" | "high" | "forbidden";
export type ProposalStatus = "draft" | "pending_review" | "approved" | "rejected" | "applied" | "rolled_back" | "deferred";
export type PolicyOutcome = "auto_apply_allowed" | "review_required" | "owner_only" | "forbidden";
export type ReviewAction = "approve" | "reject" | "defer";

export interface AdaptationProposal {
  proposal_id: string;
  proposal_type: ProposalType;
  target_type: TargetType;
  target_id: string;
  title: string;
  rationale: string;
  evidence_refs: string[];
  risk_class: ProposalRiskClass;
  proposed_change: Record<string, unknown>;
  status: ProposalStatus;
  policy_outcome?: PolicyOutcome;
  created_at: string;
  created_by: string;
}

export interface ProposalEvidenceRef {
  ref_id: string;
  proposal_id: string;
  evidence_type: string;
  evidence_id: string;
  summary: string;
  created_at: string;
}

export interface PolicyDecision {
  proposal_id: string;
  outcome: PolicyOutcome;
  risk_class: ProposalRiskClass;
  reasons: string[];
  evaluated_at: string;
}

export interface ReviewDecision {
  review_id: string;
  proposal_id: string;
  action: ReviewAction;
  reviewer_id: string;
  notes: string;
  created_at: string;
}

export interface AppliedChangeRecord {
  change_id: string;
  proposal_id: string;
  applied_by: string;
  before_snapshot: Record<string, unknown>;
  after_snapshot: Record<string, unknown>;
  applied_at: string;
}

export interface RollbackRecord {
  rollback_id: string;
  change_id: string;
  proposal_id: string;
  rolled_back_by: string;
  reason: string;
  rolled_back_at: string;
}

export interface ProposalAuditTrail {
  proposal_id: string;
  events: Array<{
    event_type: string;
    actor: string;
    details: Record<string, unknown>;
    timestamp: string;
  }>;
}
