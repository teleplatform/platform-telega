import type { DistributedReplayPlan, TraceEvent, ReplayValidationResult } from './mesh-replay-types.js';

export function validateReplayPlan(
  plan: DistributedReplayPlan,
  traces: TraceEvent[]
): ReplayValidationResult {
  const mismatches: string[] = [];
  const missingTraces: string[] = [];

  const traceIds = new Set(traces.map(t => t.traceId));

  for (const step of plan.steps) {
    if (!traceIds.has(step.traceId)) {
      missingTraces.push(step.traceId);
    }
  }

  if (missingTraces.length > 0) {
    mismatches.push(`Missing traces: ${missingTraces.join(', ')}`);
  }

  if (traces.length < plan.steps.length) {
    mismatches.push('Not all planned steps have corresponding traces');
  }

  const valid = mismatches.length === 0;

  return {
    planId: plan.planId,
    valid,
    mismatches,
    missingTraces,
    validatedAt: Date.now(),
  };
}
