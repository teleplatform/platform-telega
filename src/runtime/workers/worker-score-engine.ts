import type { RuntimeCapability } from '../sigma-forge/sigma-forge-types.js';
import type { WorkerCapabilityMetrics } from './worker-performance-store.js';
import { getMetrics, successRate, averageDuration, confidence } from './worker-performance-store.js';
import { getQualityProfile, type QualityWeights } from './capability-quality-profile.js';

export interface WorkerCapabilityScore {
  workerId: string;
  capability: RuntimeCapability;
  compositeScore: number;
  reliabilityScore: number;
  performanceScore: number;
  confidenceScore: number;
  latencyScore: number;
  metrics: WorkerCapabilityMetrics;
}

export function computeScore(workerId: string, capability: RuntimeCapability, weights?: QualityWeights): WorkerCapabilityScore {
  const metrics = getMetrics(workerId, capability);
  const profile = getQualityProfile(capability);
  const w = weights ?? profile.weights;

  const rate = successRate(metrics);
  const avgDur = averageDuration(metrics);
  const conf = confidence(metrics);

  const reliabilityScore = rate * 100;
  const latencyScore = avgDur > 0 ? Math.max(0, 100 - (avgDur / profile.maxAverageDurationMs) * 100) : 100;
  const confidenceScore = conf * 100;
  const performanceScore = (reliabilityScore * 0.6 + latencyScore * 0.4);

  const compositeScore =
    reliabilityScore * w.reliability +
    performanceScore * w.performance +
    confidenceScore * w.confidence +
    latencyScore * w.latency;

  return {
    workerId,
    capability,
    compositeScore: Math.round(compositeScore * 100) / 100,
    reliabilityScore: Math.round(reliabilityScore * 100) / 100,
    performanceScore: Math.round(performanceScore * 100) / 100,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    latencyScore: Math.round(latencyScore * 100) / 100,
    metrics
  };
}

export function rankWorkersForCapability(workerIds: string[], capability: RuntimeCapability): WorkerCapabilityScore[] {
  const scores = workerIds
    .map(wid => computeScore(wid, capability))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  return scores;
}

export function findHighestScoredWorker(workerIds: string[], capability: RuntimeCapability): { workerId: string; score: WorkerCapabilityScore } | null {
  const ranked = rankWorkersForCapability(workerIds, capability);
  if (ranked.length === 0) return null;
  return { workerId: ranked[0].workerId, score: ranked[0] };
}

export function getScoreBreakdown(score: WorkerCapabilityScore): string {
  return [
    `Score: ${score.compositeScore.toFixed(1)}/100`,
    `  Reliability: ${score.reliabilityScore.toFixed(1)} (${(score.metrics.successRate ?? score.metrics.successfulExecutions / Math.max(1, score.metrics.totalExecutions)) * 100}% success)`,
    `  Performance: ${score.performanceScore.toFixed(1)} (avg ${averageDuration(score.metrics).toFixed(0)}ms)`,
    `  Confidence: ${score.confidenceScore.toFixed(1)} (${score.metrics.totalExecutions} samples)`,
    `  Latency: ${score.latencyScore.toFixed(1)}`,
    `  Failures: ${score.metrics.failedExecutions} (consecutive: ${score.metrics.consecutiveFailures})`
  ].join('\n');
}

export function formatScoreCompact(score: WorkerCapabilityScore): string {
  const rate = score.metrics.totalExecutions > 0
    ? (score.metrics.successfulExecutions / score.metrics.totalExecutions * 100).toFixed(0)
    : '100';
  const avg = averageDuration(score.metrics).toFixed(0);
  return `#${score.compositeScore.toFixed(0)} [${rate}% ${avg}ms]`;
}
