export type ProposalStatus = "draft" | "review" | "approved" | "rejected" | "applied";
export type SignalCategory = "agent_performance" | "provider_performance" | "repair_performance" | "mission_performance" | "schedule_slippage";

export interface Outcome {
  outcomeId: string;
  missionId: string;
  graphId: string;
  success: boolean;
  durationMs: number;
  agentRoles: string[];
  providerUsed: string;
  repairsTriggered: number;
  rollbacksUsed: number;
  evidenceRefs: string[];
  createdAt: number;
}

export interface LearningSignal {
  signalId: string;
  category: SignalCategory;
  description: string;
  confidence: number;
  evidenceRefs: string[];
  metricValue: number;
  threshold: number;
  createdAt: number;
}

export interface ImprovementProposal {
  proposalId: string;
  title: string;
  rationale: string;
  evidenceRefs: string[];
  confidence: number;
  status: ProposalStatus;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export interface OutcomeSummary {
  totalOutcomes: number;
  successRate: number;
  avgDurationMs: number;
  totalRepairs: number;
  totalRollbacks: number;
  topPerformer: string | null;
  topWeakness: string | null;
  proposalsPending: number;
}
