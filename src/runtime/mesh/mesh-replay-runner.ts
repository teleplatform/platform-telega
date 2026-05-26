import type {
  DistributedReplayPlan,
  ReplayExecutionResult,
  ReplayStep,
} from './mesh-replay-types.js';

const executions = new Map<string, ReplayExecutionResult>();

export function executeReplayStep(step: ReplayStep, planId: string): { success: boolean; error?: string } {
  // Minimal deterministic execution - no real side effects
  // In real implementation this would replay the actual action on the target node
  if (!step.action || !step.traceId) {
    return { success: false, error: 'Invalid step: missing action or traceId' };
  }

  return { success: true };
}

export function executeReplayPlan(plan: DistributedReplayPlan): ReplayExecutionResult {
  const startTime = Date.now();
  let executed = 0;
  let failed = 0;
  const errors: string[] = [];

  // Sort steps respecting dependencies (simple topological order by dependsOn)
  const sortedSteps = [...plan.steps].sort((a, b) => {
    if (a.dependsOn?.includes(b.stepId)) return 1;
    if (b.dependsOn?.includes(a.stepId)) return -1;
    return 0;
  });

  for (const step of sortedSteps) {
    const result = executeReplayStep(step, plan.planId);
    if (result.success) {
      executed++;
    } else {
      failed++;
      if (result.error) errors.push(result.error);
    }
  }

  const endTime = Date.now();

  const execution: ReplayExecutionResult = {
    planId: plan.planId,
    status: failed === 0 ? 'completed' : 'failed',
    executedSteps: executed,
    failedSteps: failed,
    startTime,
    endTime,
    errors,
  };

  executions.set(plan.planId, execution);
  return execution;
}

export function recordReplayExecution(execution: ReplayExecutionResult): void {
  executions.set(execution.planId, execution);
}

export function getReplayExecution(planId: string): ReplayExecutionResult | undefined {
  return executions.get(planId);
}

export function clearReplayExecutions(): void {
  executions.clear();
}
