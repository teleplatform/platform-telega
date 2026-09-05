import { ProviderStats, RoutingProfile, RoutingDecision } from "./routerTypes";
import { getProviderStats, getStatsByTask } from "./providerStats";

function calculateScore(stats: ProviderStats): number {
  const total = stats.successCount + stats.failureCount;
  if (total === 0) return 50;

  const successRate = stats.successCount / total;
  const avgLatency = stats.totalDurationMs / total;
  const repairRate = total > 0 ? stats.repairCount / total : 0;
  const rollbackRate = total > 0 ? stats.rollbackCount / total : 0;

  // Score formula: success rate weighted heavily, penalties for latency/repairs/rollbacks
  let score =
    successRate * 60 +
    Math.max(0, 20 - avgLatency / 10000) * 15 +
    (1 - repairRate) * 15 +
    (1 - rollbackRate) * 10;

  return Math.round(Math.max(0, Math.min(100, score)));
}

export function buildProfiles(): RoutingProfile[] {
  const byTask = new Map<string, ProviderStats[]>();
  for (const s of getProviderStats()) {
    if (!byTask.has(s.taskType)) byTask.set(s.taskType, []);
    byTask.get(s.taskType)!.push(s);
  }

  const profiles: RoutingProfile[] = [];
  for (const [taskType, taskStats] of byTask) {
    const total = taskStats.reduce((s, p) => s + p.successCount + p.failureCount, 0);
    const successes = taskStats.reduce((s, p) => s + p.successCount, 0);
    const successRate = total > 0 ? Math.round((successes / total) * 100) : 0;
    const avgLatency = total > 0
      ? Math.round(taskStats.reduce((s, p) => s + p.totalDurationMs, 0) / total)
      : 0;

    const scored = taskStats.map((s) => ({
      providerId: s.providerId,
      score: calculateScore(s),
      reason: scoreExplanation(s),
    })).sort((a, b) => b.score - a.score);

    profiles.push({
      profileId: `profile_${taskType}_${Date.now()}`,
      taskType,
      preferredProviders: scored,
      successRate,
      averageLatencyMs: avgLatency,
      sampleSize: total,
      updatedAt: Date.now(),
    });
  }

  return profiles;
}

function scoreExplanation(stats: ProviderStats): string {
  const total = stats.successCount + stats.failureCount;
  if (total === 0) return "No data";
  const rate = Math.round((stats.successCount / total) * 100);
  const parts: string[] = [`${rate}% success`];
  if (stats.repairCount > 0) parts.push(`${stats.repairCount} repairs`);
  if (stats.rollbackCount > 0) parts.push(`${stats.rollbackCount} rollbacks`);
  return parts.join(", ");
}

export function getBestProvider(taskType: string): RoutingDecision | null {
  const taskStats = getStatsByTask(taskType);
  if (taskStats.length === 0) return null;

  const scored = taskStats.map((s) => ({
    providerId: s.providerId,
    score: calculateScore(s),
  })).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const reasons: string[] = [];

  const ps = taskStats.find((s) => s.providerId === best.providerId);
  if (ps) {
    const total = ps.successCount + ps.failureCount;
    const rate = total > 0 ? Math.round((ps.successCount / total) * 100) : 0;
    reasons.push(`Success rate: ${rate}%`);
    reasons.push(`Sample size: ${total}`);
    if (ps.repairCount > 0) reasons.push(`Repairs: ${ps.repairCount}`);
  }

  return {
    taskType,
    selectedProvider: best.providerId,
    score: best.score,
    reasons,
    alternatives: scored.slice(1),
  };
}
