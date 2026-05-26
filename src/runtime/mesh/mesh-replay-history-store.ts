import type { DistributedReplayPlan, ReplayExecutionResult, ReplayValidationResult } from './mesh-replay-types.js';

interface ReplayHistoryEntry {
  plan: DistributedReplayPlan;
  execution?: ReplayExecutionResult;
  validation?: ReplayValidationResult;
  exportedAt?: number;
}

const history = new Map<string, ReplayHistoryEntry>();

export function recordReplayHistory(
  plan: DistributedReplayPlan,
  execution?: ReplayExecutionResult,
  validation?: ReplayValidationResult
): void {
  history.set(plan.planId, { plan, execution, validation });
}

export function getReplayHistory(planId: string): ReplayHistoryEntry | undefined {
  return history.get(planId);
}

export function listReplayHistory(): ReplayHistoryEntry[] {
  return Array.from(history.values());
}

export function clearReplayHistory(): void {
  history.clear();
}
