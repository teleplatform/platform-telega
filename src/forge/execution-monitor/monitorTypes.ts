export type MonitorFilter = "all" | "running" | "completed" | "failed";

export interface MonitorRun {
  runId: string;
  taskId: string;
  taskTitle: string;
  graphId: string;
  graphName: string;
  status: string;
  providerId: string | null;
  agentId: string | null;
  evidenceCount: number;
  hasVerification: boolean;
  verificationVerdict: string | null;
  hasRecoveryPlan: boolean;
  recoveryAction: string | null;
  hasGovernanceDecision: boolean;
  governanceVerdict: string | null;
  hasArtifacts: boolean;
  durationMs: number | null;
  startedAt: number | null;
  completedAt: number | null;
}

export interface ExecutionMonitor {
  total: number;
  running: number;
  completed: number;
  failed: number;
  runs: MonitorRun[];
  generatedAt: string;
}
