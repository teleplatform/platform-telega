import { getTask, updateTask } from "./execution-store.js";

interface EvidenceRecord {
  taskId: string;
  actionId: string;
  evidence: string;
  timestamp: number;
}

const evidenceLog: EvidenceRecord[] = [];
const MAX_EVIDENCE = 500;

export function linkEvidence(taskId: string, actionId: string, evidence: string): void {
  evidenceLog.push({ taskId, actionId, evidence, timestamp: Date.now() });
  if (evidenceLog.length > MAX_EVIDENCE) evidenceLog.shift();

  const task = getTask(taskId);
  if (task) {
    updateTask(taskId, {
      evidence: [...task.evidence, `${actionId}: ${evidence}`],
    });
  }
}

export function getEvidenceForTask(taskId: string): EvidenceRecord[] {
  return evidenceLog.filter(e => e.taskId === taskId);
}

export function getEvidenceForAction(taskId: string, actionId: string): EvidenceRecord[] {
  return evidenceLog.filter(e => e.taskId === taskId && e.actionId === actionId);
}

export function getAllEvidence(): EvidenceRecord[] {
  return [...evidenceLog];
}

export function evidenceSummary(): string {
  if (evidenceLog.length === 0) return "No evidence records.";
  const byTask = new Map<string, number>();
  for (const e of evidenceLog) {
    byTask.set(e.taskId, (byTask.get(e.taskId) || 0) + 1);
  }
  return Array.from(byTask.entries())
    .map(([taskId, count]) => `  ${taskId}: ${count} evidence entries`)
    .join("\n");
}
