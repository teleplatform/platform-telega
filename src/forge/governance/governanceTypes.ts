export type OutcomeKind =
  | "mission_success" | "mission_failed"
  | "job_completed" | "job_failed"
  | "agent_success" | "agent_failed"
  | "provider_success" | "provider_failed"
  | "policy_denied" | "policy_approved"
  | "repair_succeeded" | "repair_failed"
  | "resource_denied" | "override_executed";

export type OutcomeSource =
  | "mission" | "job" | "agent" | "provider"
  | "policy" | "repair" | "resource" | "override";

export type OutcomeSeverity = "info" | "warning" | "critical";

export interface GovernanceOutcome {
  outcomeId: string;
  kind: OutcomeKind;
  source: OutcomeSource;
  severity: OutcomeSeverity;
  summary: string;
  details: Record<string, unknown>;
  evidenceRefs: string[];
  trusted: boolean;
  timestamp: number;
}

export interface OutcomeQuery {
  kinds?: OutcomeKind[];
  sources?: OutcomeSource[];
  severities?: OutcomeSeverity[];
  trusted?: boolean;
  since?: number;
  until?: number;
  limit?: number;
}

export interface OutcomeDigest {
  total: number;
  successRate: number;
  failureRate: number;
  blockedCount: number;
  policyDenials: number;
  humanOverrides: number;
  repairSuccessRate: number;
  providerReliability: Record<string, number>;
  bySource: Record<string, number>;
  bySeverity: Record<string, number>;
}
