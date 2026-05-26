import type { DistributedReplayPlan, TraceEvent } from './mesh-replay-types.js';

export function exportReplayToCSV(traces: TraceEvent[]): string {
  const header = 'timestamp,traceId,eventId,nodeId,type,parentEventId,payload';
  const rows = traces.map(trace => {
    const payload = JSON.stringify(trace.payload).replace(/"/g, '""');
    return [
      trace.timestamp,
      trace.traceId,
      trace.eventId,
      trace.nodeId,
      trace.type,
      trace.parentEventId || '',
      `"${payload}"`,
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

export function exportReplayStepsToCSV(plan: DistributedReplayPlan): string {
  const header = 'stepId,traceId,nodeId,action,dependsOn,payload';
  const rows = plan.steps.map(step => {
    const payload = JSON.stringify(step.payload).replace(/"/g, '""');
    return [
      step.stepId,
      step.traceId,
      step.nodeId,
      step.action,
      (step.dependsOn || []).join('|'),
      `"${payload}"`,
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

export async function saveReplayCSV(path: string, csv: string): Promise<void> {
  const fs = await import('fs/promises');
  await fs.writeFile(path, csv, 'utf8');
}
