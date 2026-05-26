import type { RuntimeCapability } from '../sigma-forge/sigma-forge-types.js';
import { getAllMetrics, successRate, averageDuration, confidence, performanceSummary } from './worker-performance-store.js';
import { computeScore } from './worker-score-engine.js';
import { getAllWorkers } from './worker-registry.js';
import { getAllQualityProfiles } from './capability-quality-profile.js';
import { assessAllWorkers } from './worker-execution-metrics.js';

export function renderQualityDashboard(): string {
  const lines: string[] = [];
  const sep = '─'.repeat(32);

  lines.push('📊 WORKER QUALITY DASHBOARD');
  lines.push(sep);

  const allMetrics = getAllMetrics();
  if (allMetrics.length === 0) {
    lines.push('No execution data yet');
    return lines.join('\n');
  }

  const workers = getAllWorkers();
  const workerMap = new Map(workers.map(w => [w.id, w]));

  // Group by capability
  const byCapability = new Map<RuntimeCapability, typeof allMetrics>();
  for (const m of allMetrics) {
    if (!byCapability.has(m.capability)) byCapability.set(m.capability, []);
    byCapability.get(m.capability)!.push(m);
  }

  lines.push(`Workers: ${workers.length} | Capabilities: ${byCapability.size}`);
  lines.push(sep);

  for (const [cap, metrics] of byCapability) {
    const profile = getAllQualityProfiles().find(p => p.capability === cap);
    lines.push(`\n${cap.toUpperCase()} ${profile ? `(min ${(profile.minSuccessRate * 100).toFixed(0)}% / max ${profile.maxAverageDurationMs}ms)` : ''}`);

    for (const m of metrics) {
      const rate = successRate(m);
      const avgDur = averageDuration(m);
      const conf = confidence(m);
      const w = workerMap.get(m.workerId);

      const score = computeScore(m.workerId, m.capability);

      const statusIcon = m.consecutiveFailures >= 3 ? '🔴' : m.consecutiveFailures > 0 ? '🟡' : '🟢';
      const nameStr = w ? w.name : m.workerId;

      lines.push(`  ${statusIcon} ${nameStr}`);
      lines.push(`     Score: ${score.compositeScore.toFixed(1)}/100 | ${(rate * 100).toFixed(1)}% success | ${avgDur.toFixed(0)}ms avg | ${(conf * 100).toFixed(0)}% confidence`);
      lines.push(`     Executions: ${m.totalExecutions} (${m.successfulExecutions} ok / ${m.failedExecutions} fail)`);
      lines.push(`     Consecutive failures: ${m.consecutiveFailures} | Max: ${m.maxConsecutiveFailures}`);
      if (m.lastError) lines.push(`     Last error: ${m.lastError}`);
    }
  }

  lines.push('');
  lines.push(sep);
  lines.push(performanceSummary());

  const assessment = assessAllWorkers();
  const totalPassed = Object.values(assessment).reduce((s, v) => s + v.passed, 0);
  const totalDegraded = Object.values(assessment).reduce((s, v) => s + v.degraded, 0);
  lines.push(`Quality: ${totalPassed} passed, ${totalDegraded} degraded`);

  return lines.join('\n');
}

export function renderWorkerScoreCompact(workerId: string, capability: RuntimeCapability): string {
  try {
    const score = computeScore(workerId, capability);
    return `${score.compositeScore.toFixed(0)} (${score.reliabilityScore.toFixed(0)} rel / ${score.performanceScore.toFixed(0)} perf / ${score.confidenceScore.toFixed(0)} conf)`;
  } catch {
    return 'No data';
  }
}

export function renderCapabilityRanking(capability: RuntimeCapability): string {
  const metrics = getAllMetrics().filter(m => m.capability === capability);
  if (metrics.length === 0) return `No workers for ${capability}`;

  const workers = getAllWorkers();
  const workerMap = new Map(workers.map(w => [w.id, w]));

  const sorted = metrics.sort((a, b) => {
    const scoreA = computeScore(a.workerId, a.capability);
    const scoreB = computeScore(b.workerId, b.capability);
    return scoreB.compositeScore - scoreA.compositeScore;
  });

  const lines = [`Ranking for ${capability.toUpperCase()}:`];
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    const w = workerMap.get(m.workerId);
    const score = computeScore(m.workerId, m.capability);
    const name = w?.name ?? m.workerId;
    const rate = successRate(m);
    const avg = averageDuration(m);
    lines.push(`  #${i + 1} ${name} — ${score.compositeScore.toFixed(1)} (${(rate * 100).toFixed(1)}% / ${avg.toFixed(0)}ms)`);
  }

  return lines.join('\n');
}
