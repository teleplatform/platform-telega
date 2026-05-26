import type { DistributedReplayPlan, ReplayStep, TraceEvent } from './mesh-replay-types.js';

const plans = new Map<string, DistributedReplayPlan>();

export function createDistributedReplayPlan(
  evidenceIds: string[],
  traces: TraceEvent[],
  contractId?: string
): DistributedReplayPlan {
  const planId = `replay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const steps: ReplayStep[] = traces.map((trace, index) => ({
    stepId: `step_${index}`,
    traceId: trace.traceId,
    nodeId: trace.nodeId,
    action: trace.type,
    dependsOn: trace.parentEventId ? [`step_${traces.findIndex(t => t.eventId === trace.parentEventId)}`] : undefined,
    payload: trace.payload,
  }));

  const plan: DistributedReplayPlan = {
    planId,
    contractId,
    evidenceIds,
    traceIds: [...new Set(traces.map(t => t.traceId))],
    steps,
    createdAt: Date.now(),
    status: 'planned',
  };

  plans.set(planId, plan);
  return plan;
}

export function getReplayPlan(planId: string): DistributedReplayPlan | undefined {
  return plans.get(planId);
}

export function listReplayPlans(): DistributedReplayPlan[] {
  return Array.from(plans.values());
}

export function updateReplayPlanStatus(planId: string, status: DistributedReplayPlan['status']): boolean {
  const plan = plans.get(planId);
  if (!plan) return false;
  plan.status = status;
  return true;
}

export function clearReplayPlans(): void {
  plans.clear();
}
