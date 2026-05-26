interface BlockedActionRecord {
  taskId: string;
  actionId: string;
  actionLabel: string;
  actionType: string;
  risk: string;
  reason: string;
  policyMatch?: string;
  timestamp: number;
}

const blockedLog: BlockedActionRecord[] = [];
const MAX_BLOCKED_LOG = 200;

export function recordBlockedAction(
  taskId: string,
  actionId: string,
  actionLabel: string,
  actionType: string,
  risk: string,
  reason: string,
  policyMatch?: string,
): void {
  blockedLog.push({
    taskId,
    actionId,
    actionLabel,
    actionType,
    risk,
    reason,
    policyMatch,
    timestamp: Date.now(),
  });
  if (blockedLog.length > MAX_BLOCKED_LOG) blockedLog.shift();
}

export function getBlockedActionsForTask(taskId: string): BlockedActionRecord[] {
  return blockedLog.filter(r => r.taskId === taskId);
}

export function getAllBlockedActions(): BlockedActionRecord[] {
  return [...blockedLog];
}

export function blockedActionsSummary(): string {
  if (blockedLog.length === 0) return "No blocked actions.";
  const byRisk = new Map<string, number>();
  for (const r of blockedLog) {
    byRisk.set(r.risk, (byRisk.get(r.risk) || 0) + 1);
  }
  const riskBreakdown = Array.from(byRisk.entries())
    .map(([risk, count]) => `${risk}: ${count}`)
    .join(", ");
  const lines = blockedLog.slice(-5).map(r =>
    `  [${r.risk}] ${r.actionLabel} (${r.actionType}) — ${r.reason}`
  );
  return `Total blocked: ${blockedLog.length} (${riskBreakdown})\nRecent:\n${lines.join("\n")}`;
}
