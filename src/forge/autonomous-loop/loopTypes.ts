export type LoopStatus = "running" | "completed" | "blocked" | "cancelled" | "waiting_approval";

export interface LoopConfig {
  maxSteps: number;
  maxRetriesPerStep: number;
  requireVerification: boolean;
  stopOnCriticalRisk: boolean;
  stopOnSameErrorTwice: boolean;
}

export interface LoopStep {
  stepId: string;
  taskId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  attempts: number;
  lastError: string | null;
  evidenceRefs: string[];
  createdAt: number;
  completedAt: number | null;
}

export interface LoopSession {
  id: string;
  graphId: string;
  name: string;
  status: LoopStatus;
  config: LoopConfig;
  steps: LoopStep[];
  currentStepIndex: number;
  evidenceRefs: string[];
  approvalRef?: string;
  createdAt: number;
  updatedAt: number;
}
