export type ReplayStatus = 'planned' | 'running' | 'completed' | 'failed' | 'validated';

export interface TraceEvent {
  traceId: string;
  eventId: string;
  nodeId: string;
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
  parentEventId?: string;
}

export interface DistributedReplayPlan {
  planId: string;
  contractId?: string;
  evidenceIds: string[];
  traceIds: string[];
  steps: ReplayStep[];
  createdAt: number;
  status: ReplayStatus;
}

export interface ReplayStep {
  stepId: string;
  traceId: string;
  nodeId: string;
  action: string;
  dependsOn?: string[];
  payload: Record<string, unknown>;
}

export interface ReplayExecutionResult {
  planId: string;
  status: ReplayStatus;
  executedSteps: number;
  failedSteps: number;
  startTime: number;
  endTime?: number;
  errors: string[];
}

export interface ReplayValidationResult {
  planId: string;
  valid: boolean;
  mismatches: string[];
  missingTraces: string[];
  validatedAt: number;
}
