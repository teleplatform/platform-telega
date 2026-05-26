import type { DistributedReplayPlan, TraceEvent, ReplayValidationResult } from './mesh-replay-types.js';

export interface ForensicSummary {
  planId: string;
  totalEvents: number;
  uniqueNodes: string[];
  timeRange: { start: number; end: number };
  eventTypeBreakdown: Record<string, number>;
  validationStatus: string;
  anomalies: string[];
  generatedAt: number;
}

export function createForensicSummary(
  plan: DistributedReplayPlan,
  traces: TraceEvent[],
  validation?: ReplayValidationResult
): ForensicSummary {
  const uniqueNodes = [...new Set(traces.map(t => t.nodeId))];
  const timestamps = traces.map(t => t.timestamp);
  const start = Math.min(...timestamps);
  const end = Math.max(...timestamps);

  const typeBreakdown: Record<string, number> = {};
  traces.forEach(t => {
    typeBreakdown[t.type] = (typeBreakdown[t.type] || 0) + 1;
  });

  const anomalies: string[] = [];
  if (validation && !validation.valid) {
    anomalies.push(...validation.mismatches);
  }
  if (traces.length !== plan.steps.length) {
    anomalies.push('Trace count does not match plan steps');
  }

  return {
    planId: plan.planId,
    totalEvents: traces.length,
    uniqueNodes,
    participatingNodes: uniqueNodes,
    timeRange: { start, end },
    eventTypeBreakdown: typeBreakdown,
    validationStatus: validation ? (validation.valid ? 'valid' : 'invalid') : 'not_validated',
    anomalies,
    generatedAt: Date.now(),
  };
}
