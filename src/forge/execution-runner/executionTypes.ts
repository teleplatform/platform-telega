export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface ExecutionRun {
  id: string;
  taskId: string;
  graphId: string;
  agentId: string | null;
  providerId: string | null;
  status: RunStatus;
  evidenceRefs: string[];
  result: string | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
}

export interface RunPolicy {
  maxRetries: number;
  timeoutMs: number;
  recordEvidence: boolean;
}
