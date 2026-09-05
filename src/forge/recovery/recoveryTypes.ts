export type RecoveryStatus = "safe" | "dirty" | "failed" | "rolled_back" | "resumed";

export interface RecoveryPoint {
  id: string;
  graphId: string;
  jobNodeId: string | null;
  capsuleId: string | null;
  status: RecoveryStatus;
  fileHashes: Array<{ file: string; sha256: string }>;
  artifacts: string[];
  reason: string;
  createdAt: number;
  rolledBackAt: number | null;
}

export interface RollbackStep {
  kind: "restore_file" | "delete_artifact" | "reset_job" | "restore_evidence";
  target: string;
  value?: string;
}

export interface RollbackPlan {
  id: string;
  recoveryPointId: string;
  reason: string;
  steps: RollbackStep[];
  estimatedImpact: string[];
  createdAt: number;
}

export interface RollbackResult {
  planId: string;
  ok: boolean;
  stepsCompleted: number;
  stepsFailed: number;
  evidence: Array<{ step: string; ok: boolean; error?: string }>;
  completedAt: number;
}

export interface ResumePlan {
  graphId: string;
  recoveryPointId: string | null;
  completedLevels: number;
  jobsToRetry: string[];
  jobsToSkip: string[];
}
