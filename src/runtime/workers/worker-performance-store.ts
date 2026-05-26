import fs from 'node:fs';
import path from 'node:path';
import type { RuntimeCapability } from '../sigma-forge/sigma-forge-types.js';

export interface WorkerCapabilityMetrics {
  workerId: string;
  capability: RuntimeCapability;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalDurationMs: number;
  lastDurationMs: number | null;
  lastError: string | null;
  lastExecutedAt: number | null;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
}

const metricsMap = new Map<string, WorkerCapabilityMetrics>();
const STORE_PATH = path.join(process.cwd(), '.data', 'runtime', 'worker-performance.jsonl');

function key(workerId: string, capability: RuntimeCapability): string {
  return `${workerId}:${capability}`;
}

function load(): void {
  if (!fs.existsSync(STORE_PATH)) return;
  try {
    const content = fs.readFileSync(STORE_PATH, 'utf8');
    for (const line of content.split('\n').filter(Boolean)) {
      const m = JSON.parse(line) as WorkerCapabilityMetrics;
      metricsMap.set(key(m.workerId, m.capability), m);
    }
  } catch { }
}

function save(metric: WorkerCapabilityMetrics): void {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(STORE_PATH, JSON.stringify(metric) + '\n', 'utf8');
  } catch { }
}

export function getMetrics(workerId: string, capability: RuntimeCapability): WorkerCapabilityMetrics {
  load();
  const k = key(workerId, capability);
  if (!metricsMap.has(k)) {
    metricsMap.set(k, {
      workerId, capability,
      totalExecutions: 0, successfulExecutions: 0, failedExecutions: 0,
      totalDurationMs: 0, lastDurationMs: null,
      lastError: null, lastExecutedAt: null,
      consecutiveFailures: 0, maxConsecutiveFailures: 0
    });
  }
  return metricsMap.get(k)!;
}

export function recordSuccess(workerId: string, capability: RuntimeCapability, durationMs: number): void {
  const m = getMetrics(workerId, capability);
  m.totalExecutions++;
  m.successfulExecutions++;
  m.totalDurationMs += durationMs;
  m.lastDurationMs = durationMs;
  m.lastError = null;
  m.lastExecutedAt = Date.now();
  m.consecutiveFailures = 0;
  save(m);
}

export function recordFailure(workerId: string, capability: RuntimeCapability, durationMs: number, error: string): void {
  const m = getMetrics(workerId, capability);
  m.totalExecutions++;
  m.failedExecutions++;
  m.totalDurationMs += durationMs;
  m.lastDurationMs = durationMs;
  m.lastError = error;
  m.lastExecutedAt = Date.now();
  m.consecutiveFailures++;
  if (m.consecutiveFailures > m.maxConsecutiveFailures) {
    m.maxConsecutiveFailures = m.consecutiveFailures;
  }
  save(m);
}

export function getAllMetrics(): WorkerCapabilityMetrics[] {
  load();
  return [...metricsMap.values()];
}

export function getMetricsForWorker(workerId: string): WorkerCapabilityMetrics[] {
  load();
  return [...metricsMap.values()].filter(m => m.workerId === workerId);
}

export function getMetricsForCapability(capability: RuntimeCapability): WorkerCapabilityMetrics[] {
  load();
  return [...metricsMap.values()].filter(m => m.capability === capability);
}

export function successRate(metrics: WorkerCapabilityMetrics): number {
  if (metrics.totalExecutions === 0) return 1;
  return metrics.successfulExecutions / metrics.totalExecutions;
}

export function averageDuration(metrics: WorkerCapabilityMetrics): number {
  if (metrics.totalExecutions === 0) return 0;
  return metrics.totalDurationMs / metrics.totalExecutions;
}

export function confidence(metrics: WorkerCapabilityMetrics): number {
  // Confidence grows with sample size, asymptotically approaches 1
  return Math.min(1, metrics.totalExecutions / 20);
}

export function performanceSummary(): string {
  const all = getAllMetrics();
  if (all.length === 0) return 'No performance data';
  const totalExec = all.reduce((s, m) => s + m.totalExecutions, 0);
  const totalFail = all.reduce((s, m) => s + m.failedExecutions, 0);
  const avgDur = all.reduce((s, m) => s + averageDuration(m), 0) / Math.max(1, all.length);
  const rate = totalExec > 0 ? ((totalExec - totalFail) / totalExec * 100).toFixed(1) : '100.0';
  return `Performance: ${totalExec} executions, ${rate}% success, avg ${avgDur.toFixed(0)}ms across ${all.length} worker-capability pairs`;
}
