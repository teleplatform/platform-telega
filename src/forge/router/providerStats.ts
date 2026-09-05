import { ProviderStats } from "./routerTypes";

const stats: ProviderStats[] = [];

export function recordOutcome(
  providerId: string,
  taskType: string,
  success: boolean,
  durationMs: number,
  costUsd: number,
  repairTriggered: boolean,
  rollbackUsed: boolean
): ProviderStats {
  let stat = stats.find((s) => s.providerId === providerId && s.taskType === taskType);
  if (!stat) {
    stat = {
      providerId,
      taskType,
      successCount: 0,
      failureCount: 0,
      totalDurationMs: 0,
      totalCostUsd: 0,
      repairCount: 0,
      rollbackCount: 0,
      lastUsedAt: 0,
    };
    stats.push(stat);
  }

  if (success) stat.successCount++;
  else stat.failureCount++;
  stat.totalDurationMs += durationMs;
  stat.totalCostUsd += costUsd;
  if (repairTriggered) stat.repairCount++;
  if (rollbackUsed) stat.rollbackCount++;
  stat.lastUsedAt = Date.now();

  return stat;
}

export function getProviderStats(): ProviderStats[] {
  return [...stats];
}

export function getStats(providerId: string, taskType?: string): ProviderStats | undefined {
  if (taskType) return stats.find((s) => s.providerId === providerId && s.taskType === taskType);
  return stats.filter((s) => s.providerId === providerId)[0];
}

export function getStatsByTask(taskType: string): ProviderStats[] {
  return stats.filter((s) => s.taskType === taskType);
}

export function clearStats(): void {
  stats.length = 0;
}
