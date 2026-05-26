import type { RuntimeCapability } from '../sigma-forge/sigma-forge-types.js';
import { recordSuccess, recordFailure, getMetrics, successRate, averageDuration, confidence, getAllMetrics, performanceSummary } from './worker-performance-store.js';
import { computeScore } from './worker-score-engine.js';
import { checkQualityThreshold } from './capability-quality-profile.js';
import { updateWorkerStatus } from './worker-registry.js';

export function recordWorkerSuccess(workerId: string, capability: RuntimeCapability, durationMs: number): { degraded: boolean; reasons: string[] } {
  recordSuccess(workerId, capability, durationMs);
  return checkWorkerQuality(workerId, capability);
}

export function recordWorkerFailure(workerId: string, capability: RuntimeCapability, durationMs: number, error: string): { degraded: boolean; reasons: string[] } {
  recordFailure(workerId, capability, durationMs, error);
  return checkWorkerQuality(workerId, capability);
}

export function checkWorkerQuality(workerId: string, capability: RuntimeCapability): { degraded: boolean; reasons: string[] } {
  const metrics = getMetrics(workerId, capability);
  const rate = successRate(metrics);
  const avgDur = averageDuration(metrics);
  const conf = confidence(metrics);

  const result = checkQualityThreshold(
    { successRate: rate, averageDurationMs: avgDur, totalExecutions: metrics.totalExecutions },
    capability
  );

  if (!result.pass) {
    updateWorkerStatus(workerId, 'degraded');
    return { degraded: true, reasons: result.failures };
  }

  // Auto-recover from degraded if quality restored
  if (result.pass && metrics.consecutiveFailures === 0 && metrics.totalExecutions >= 5) {
    updateWorkerStatus(workerId, 'online');
  }

  return { degraded: false, reasons: [] };
}

export function assessAllWorkers(): Record<string, { passed: number; degraded: number; total: number }> {
  const all = getAllMetrics();
  const byWorker = new Map<string, { passed: number; degraded: number; total: number }>();

  for (const m of all) {
    if (!byWorker.has(m.workerId)) {
      byWorker.set(m.workerId, { passed: 0, degraded: 0, total: 0 });
    }
    const entry = byWorker.get(m.workerId)!;
    entry.total++;
    const result = checkQualityThreshold(
      { successRate: successRate(m), averageDurationMs: averageDuration(m), totalExecutions: m.totalExecutions },
      m.capability
    );
    if (result.pass) entry.passed++;
    else entry.degraded++;
  }

  const output: Record<string, { passed: number; degraded: number; total: number }> = {};
  for (const [wid, v] of byWorker) {
    output[wid] = v;
  }
  return output;
}

export { performanceSummary };
