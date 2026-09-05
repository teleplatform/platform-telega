export type GovernanceVerdict = "allow" | "review" | "block";

export type RiskCategory =
  | "provider_risk" | "execution_risk" | "retry_risk"
  | "loop_risk" | "evidence_confidence" | "human_approval";

export interface GovernanceCheck {
  category: RiskCategory;
  score: number;
  reason: string;
}

export interface GovernanceDecision {
  id: string;
  taskId: string | null;
  graphId: string | null;
  executionRunId: string | null;
  loopId: string | null;
  riskScore: number;
  verdict: GovernanceVerdict;
  checks: GovernanceCheck[];
  reason: string;
  requiresApproval: boolean;
  approvedById: string | null;
  evidenceRefs: string[];
  createdAt: number;
}
