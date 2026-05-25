// src/runtime/forge-bridge/retry-policy.ts
// KCA-6.2 — Retry Policy Foundation
// Pure decision logic only. No execution, no mutation, no delivery.

export interface RetryPolicy {
  max_attempts: number; // default 2
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  max_attempts: 2,
};

export type BuildTaskRetryStatus =
  | "failed"
  | "timed_out"
  | "blocked"
  | "cancelled"
  | "needs_creator"
  | string;

export interface RetryableBuildTask {
  status: BuildTaskRetryStatus;
  retry_count?: number;
}

export type RetryDecisionReason =
  | "retry_allowed"
  | "retry_budget_exhausted"
  | "non_retryable_status"
  | "needs_creator_required";

export interface RetryDecision {
  can_retry: boolean;
  reason: RetryDecisionReason;
  current_attempts: number;
  max_attempts: number;
}

export function isRetryableStatus(status: string): boolean {
  return status === "failed" || status === "timed_out";
}

export function canRetryBuildTask(
  task: RetryableBuildTask,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): boolean {
  const decision = getRetryDecision(task, policy);
  return decision.can_retry;
}

export function getRetryDecision(
  task: RetryableBuildTask,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): RetryDecision {
  const current = task.retry_count ?? 0;
  const max = policy.max_attempts;

  if (!isRetryableStatus(task.status)) {
    if (task.status === "needs_creator") {
      return {
        can_retry: false,
        reason: "needs_creator_required",
        current_attempts: current,
        max_attempts: max,
      };
    }
    return {
      can_retry: false,
      reason: "non_retryable_status",
      current_attempts: current,
      max_attempts: max,
    };
  }

  if (current >= max) {
    return {
      can_retry: false,
      reason: "retry_budget_exhausted",
      current_attempts: current,
      max_attempts: max,
    };
  }

  return {
    can_retry: true,
    reason: "retry_allowed",
    current_attempts: current,
    max_attempts: max,
  };
}

// KCA-6.4 — Retry Backoff & Cooldown
export interface RetryBackoffPolicy {
  initial_ms: number;
  max_ms: number;
  multiplier: number;
}

export const DEFAULT_BACKOFF_POLICY: RetryBackoffPolicy = {
  initial_ms: 10_000,
  max_ms: 300_000,
  multiplier: 2.0,
};

export function calculateRetryBackoffMs(
  retry_count: number,
  policy: RetryBackoffPolicy = DEFAULT_BACKOFF_POLICY
): number {
  const backoff = policy.initial_ms * Math.pow(policy.multiplier, retry_count);
  return Math.min(backoff, policy.max_ms);
}

export function getNextRetryAt(now: number, retry_count: number, policy?: RetryBackoffPolicy): number {
  const backoff = calculateRetryBackoffMs(retry_count, policy);
  return now + backoff;
}
