import type { RuntimeWorker } from './worker-types.js';
import type { RuntimeCapability } from '../sigma-forge/sigma-forge-types.js';
import { getWorker, getAllWorkers, updateWorkerStatus } from './worker-registry.js';
import { getMetrics, successRate } from './worker-performance-store.js';
import { updateWorkerStatus as updateWorkerQualityStatus } from './worker-execution-metrics.js';
import { getQualityProfile } from './capability-quality-profile.js';
import { getAllMetrics } from './worker-performance-store.js';
import { emitMissionControlLiveEvent } from '../hooks/mission-control-live-feed-hook.js';

export interface DegradationRule {
  maxConsecutiveFailures: number;
  minSuccessRate: number;
  quarantineAfterFailures: number;
  quarantineDurationMs: number;
}

const DEFAULT_RULE: DegradationRule = {
  maxConsecutiveFailures: 3,
  minSuccessRate: 0.7,
  quarantineAfterFailures: 5,
  quarantineDurationMs: 300000
};

let rule: DegradationRule = { ...DEFAULT_RULE };

export function setDegradationRule(newRule: Partial<DegradationRule>): void {
  rule = { ...rule, ...newRule };
}

export function getDegradationRule(): DegradationRule {
  return { ...rule };
}

export function checkAndDegradeWorker(workerId: string, capability: RuntimeCapability): { degraded: boolean; quarantined: boolean; reasons: string[] } {
  const worker = getWorker(workerId);
  if (!worker) return { degraded: false, quarantined: false, reasons: ['worker not found'] };

  const metrics = getMetrics(workerId, capability);
  const reasons: string[] = [];

  if (metrics.consecutiveFailures >= rule.maxConsecutiveFailures) {
    reasons.push(`Consecutive failures ${metrics.consecutiveFailures} ≥ ${rule.maxConsecutiveFailures}`);
  }

  if (metrics.totalExecutions >= 5 && successRate(metrics) < rule.minSuccessRate) {
    reasons.push(`Success rate ${(successRate(metrics) * 100).toFixed(1)}% < ${(rule.minSuccessRate * 100).toFixed(0)}%`);
  }

  if (reasons.length > 0) {
    updateWorkerStatus(workerId, 'degraded');
    emitMissionControlLiveEvent({
      kind: 'execution_failed',
      severity: 'medium',
      title: `Worker degraded: ${worker.name} (${capability})`,
      trace_id: workerId,
      payload: { workerId, capability, reasons }
    });
  }

  const quarantined = metrics.consecutiveFailures >= rule.quarantineAfterFailures;
  if (quarantined) {
    worker.metadata.quarantinedAt = Date.now();
    worker.metadata.quarantineUntil = Date.now() + rule.quarantineDurationMs;
    emitMissionControlLiveEvent({
      kind: 'execution_failed',
      severity: 'high',
      title: `Worker QUARANTINED: ${worker.name} (${capability}) for ${rule.quarantineDurationMs}ms`,
      trace_id: workerId,
      payload: { workerId, capability, quarantineDurationMs: rule.quarantineDurationMs }
    });
  }

  return { degraded: reasons.length > 0, quarantined, reasons };
}

export function recoverQuarantinedWorkers(): string[] {
  const recovered: string[] = [];
  const now = Date.now();

  for (const w of getAllWorkers()) {
    const until = w.metadata?.quarantineUntil as number | undefined;
    if (until && now >= until) {
      delete w.metadata.quarantinedAt;
      delete w.metadata.quarantineUntil;
      updateWorkerStatus(w.id, w.assignedTaskIds.length > 0 ? 'busy' : 'online');

      emitMissionControlLiveEvent({
        kind: 'execution_completed',
        severity: 'info',
        title: `Worker recovered from quarantine: ${w.name}`,
        trace_id: w.id,
        payload: { workerId: w.id }
      });

      recovered.push(w.id);
    }
  }

  return recovered;
}

export function degradeAllUnderperformers(): { degraded: number; quarantined: number } {
  let degraded = 0;
  let quarantined = 0;

  for (const metrics of getAllMetrics()) {
    const result = checkAndDegradeWorker(metrics.workerId, metrics.capability);
    if (result.degraded) degraded++;
    if (result.quarantined) quarantined++;
  }

  return { degraded, quarantined };
}
