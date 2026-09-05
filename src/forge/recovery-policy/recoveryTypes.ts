export type ErrorClass = "recoverable" | "fatal" | "transient";
export type RecoveryAction = "retry" | "skip" | "escalate" | "stop";

export interface RetryPolicy {
  maxRetries: number;
  cooldownMs: number;
  backoffFactor: number;
  errorClassification: Record<string, ErrorClass>;
}

export interface RecoveryPlan {
  id: string;
  taskId: string;
  graphId: string;
  executionRunId: string;
  error: string;
  errorClass: ErrorClass;
  action: RecoveryAction;
  retryCount: number;
  lastRetryAt: number | null;
  nextRetryAt: number | null;
  evidenceRefs: string[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  cooldownMs: 30000,
  backoffFactor: 2,
  errorClassification: {
    "timeout": "transient",
    "rate_limit": "transient",
    "provider_unavailable": "transient",
    "network_error": "transient",
    "auth_required": "fatal",
    "invalid_input": "fatal",
    "verification_failed": "recoverable",
    "test_failure": "recoverable",
    "unknown": "recoverable",
  },
};
