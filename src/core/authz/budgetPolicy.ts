// Budget Policy — Pack 2.5
// Mode-based budget and rate limit enforcement

import type {
  ActorMode,
  BudgetEnvelope,
  RateEnvelope,
} from "../../types/authz.js";

export const BUDGET_BY_MODE: Record<ActorMode, BudgetEnvelope> = {
  public: {
    limit_usd: 1.0,
    max_tokens: 100_000,
    max_sessions_per_day: 50,
    max_steps_per_session: 5,
  },
  creator: {
    limit_usd: 10.0,
    max_tokens: 1_000_000,
    max_sessions_per_day: 500,
    max_steps_per_session: 20,
  },
  internal: {
    limit_usd: 100.0,
    max_tokens: 10_000_000,
    max_sessions_per_day: 5000,
    max_steps_per_session: 100,
  },
  system: {
    limit_usd: Infinity,
    max_tokens: Infinity,
    max_sessions_per_day: Infinity,
    max_steps_per_session: Infinity,
  },
};

export const RATE_BY_MODE: Record<ActorMode, RateEnvelope> = {
  public: {
    max_requests_per_minute: 10,
    max_concurrent_sessions: 3,
    burst_limit: 5,
  },
  creator: {
    max_requests_per_minute: 60,
    max_concurrent_sessions: 10,
    burst_limit: 20,
  },
  internal: {
    max_requests_per_minute: 300,
    max_concurrent_sessions: 50,
    burst_limit: 100,
  },
  system: {
    max_requests_per_minute: Infinity,
    max_concurrent_sessions: Infinity,
    burst_limit: Infinity,
  },
};

export function getBudget(mode: ActorMode): BudgetEnvelope {
  return { ...BUDGET_BY_MODE[mode] };
}

export function getRate(mode: ActorMode): RateEnvelope {
  return { ...RATE_BY_MODE[mode] };
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  remaining_usd: number;
  remaining_tokens: number;
  remaining_sessions: number;
}

export function checkBudget(
  mode: ActorMode,
  used_usd: number,
  used_tokens: number,
  used_sessions: number
): BudgetCheckResult {
  const budget = BUDGET_BY_MODE[mode];

  const remaining_usd = Math.max(0, budget.limit_usd - used_usd);
  const remaining_tokens = Math.max(0, budget.max_tokens - used_tokens);
  const remaining_sessions = Math.max(0, budget.max_sessions_per_day - used_sessions);

  if (used_usd >= budget.limit_usd) {
    return { allowed: false, reason: "budget_usd_exceeded", remaining_usd, remaining_tokens, remaining_sessions };
  }
  if (used_tokens >= budget.max_tokens) {
    return { allowed: false, reason: "budget_tokens_exceeded", remaining_usd, remaining_tokens, remaining_sessions };
  }
  if (used_sessions >= budget.max_sessions_per_day) {
    return { allowed: false, reason: "sessions_per_day_exceeded", remaining_usd, remaining_tokens, remaining_sessions };
  }

  return { allowed: true, remaining_usd, remaining_tokens, remaining_sessions };
}

export interface RateCheckResult {
  allowed: boolean;
  reason?: string;
  remaining_rpm: number;
  remaining_concurrent: number;
}

export function checkRate(
  mode: ActorMode,
  current_rpm: number,
  current_concurrent: number
): RateCheckResult {
  const rate = RATE_BY_MODE[mode];

  const remaining_rpm = Math.max(0, rate.max_requests_per_minute - current_rpm);
  const remaining_concurrent = Math.max(0, rate.max_concurrent_sessions - current_concurrent);

  if (current_rpm >= rate.max_requests_per_minute) {
    return { allowed: false, reason: "rpm_exceeded", remaining_rpm, remaining_concurrent };
  }
  if (current_concurrent >= rate.max_concurrent_sessions) {
    return { allowed: false, reason: "concurrent_sessions_exceeded", remaining_rpm, remaining_concurrent };
  }

  return { allowed: true, remaining_rpm, remaining_concurrent };
}
