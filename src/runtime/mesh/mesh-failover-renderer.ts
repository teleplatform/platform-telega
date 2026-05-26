import type { FailoverSummary } from './failover-summary.js';

export function renderFailoverStatus(summary: FailoverSummary): string {
  const status = summary.failedRecoveries > 0 ? '⚠️' : '✅';
  return `${status} Failover ${summary.nodeId}: ${summary.successfulRecoveries}/${summary.reassignments} recovered`;
}

export function renderRecentFailovers(failovers: FailoverSummary[]): string {
  if (failovers.length === 0) return 'No recent failovers.';

  return failovers
    .slice(0, 5)
    .map(f => renderFailoverStatus(f))
    .join('\n');
}

export function renderFailoverSummary(summary: FailoverSummary): string {
  return [
    `Failover Summary for ${summary.nodeId}`,
    `Trigger: ${summary.trigger}`,
    `Strategy: ${summary.strategy}`,
    `Reassignments: ${summary.reassignments}`,
    `Successful: ${summary.successfulRecoveries}`,
    `Failed: ${summary.failedRecoveries}`,
    `Health Impact: ${summary.healthImpact}`,
  ].join('\n');
}
