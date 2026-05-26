import type {
  DistributedReplayPlan,
  TraceEvent,
  ReplayValidationResult,
} from './mesh-replay-types.js';

export interface ReplayExportBundle {
  exportVersion: string;
  createdAt: number;
  planId: string;
  contractId?: string;
  evidenceIds: string[];
  traceIds: string[];
  steps: any[];
  traces: TraceEvent[];
  validation?: ReplayValidationResult;
  summary?: Record<string, unknown>;
}

export function createReplayExportBundle(
  plan: DistributedReplayPlan,
  traces: TraceEvent[],
  validation?: ReplayValidationResult,
  summary?: Record<string, unknown>
): ReplayExportBundle {
  return {
    exportVersion: '1.0.0',
    createdAt: Date.now(),
    planId: plan.planId,
    contractId: plan.contractId,
    evidenceIds: plan.evidenceIds,
    traceIds: plan.traceIds,
    steps: plan.steps,
    traces,
    validation,
    summary,
  };
}

export function exportReplayToJSON(
  plan: DistributedReplayPlan,
  traces: TraceEvent[],
  validation?: ReplayValidationResult,
  summary?: Record<string, unknown>
): string {
  const bundle = createReplayExportBundle(plan, traces, validation, summary);
  return JSON.stringify(bundle, null, 2);
}

export async function saveReplayJSON(
  path: string,
  bundleOrJson: ReplayExportBundle | string
): Promise<void> {
  const fs = await import('fs/promises');
  const content = typeof bundleOrJson === 'string' 
    ? bundleOrJson 
    : JSON.stringify(bundleOrJson, null, 2);
  await fs.writeFile(path, content, 'utf8');
}
