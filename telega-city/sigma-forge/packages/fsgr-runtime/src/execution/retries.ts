import type { SkillUnit } from "../../fsgr-contracts/src/index.js";

export function shouldRetry(errorCode: string, retryPolicy: SkillUnit["retry_policy"], currentRetryCount: number): boolean {
  if (currentRetryCount >= retryPolicy.max_attempts) return false;
  return retryPolicy.retryable_errors.includes(errorCode);
}

export function computeRetryDelay(retryPolicy: SkillUnit["retry_policy"], currentRetryCount: number): number {
  return retryPolicy.backoff_ms * Math.pow(2, currentRetryCount);
}

export interface RetryDecision {
  should_retry: boolean;
  reason: string;
  delay_ms: number;
}

export function buildRetryDecision(errorCode: string, retryPolicy: SkillUnit["retry_policy"], currentRetryCount: number): RetryDecision {
  if (currentRetryCount >= retryPolicy.max_attempts) {
    return { should_retry: false, reason: "max_attempts_exceeded", delay_ms: 0 };
  }
  if (!retryPolicy.retryable_errors.includes(errorCode)) {
    return { should_retry: false, reason: "non_retryable_error", delay_ms: 0 };
  }
  return { should_retry: true, reason: "retryable", delay_ms: computeRetryDelay(retryPolicy, currentRetryCount) };
}
