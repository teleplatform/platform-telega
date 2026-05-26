import { loadTasks, getInterruptedTasks, updateTask, getAllTasks } from "./execution-store.js";
import { recordRuntimeEvent } from "../memory/operational-memory.js";

export interface RecoveryResult {
  recovered: number;
  failed: number;
  total: number;
  details: string[];
}

export function recoverTasks(): RecoveryResult {
  loadTasks();
  const all = getAllTasks();
  const interrupted = getInterruptedTasks();
  const details: string[] = [];
  let recovered = 0;
  let failed = 0;

  for (const task of interrupted) {
    const ageHours = (Date.now() - task.updatedAt) / (1000 * 60 * 60);

    if (ageHours > 48) {
      updateTask(task.id, {
        status: "failed",
        evidence: [...task.evidence, "failed: interrupted for >48h, not recoverable"],
      });
      failed++;
      details.push(`[failed] ${task.title} — interrupted ${Math.round(ageHours)}h ago, too old to recover`);
      continue;
    }

    let lastDoneIndex = -1;
    for (let j = 0; j < task.actions.length; j++) {
      if (task.actions[j].status === "done") lastDoneIndex = j;
    }
    const resumeFrom = lastDoneIndex >= 0 ? lastDoneIndex + 1 : 0;

    const remaining = task.actions.slice(resumeFrom);
    updateTask(task.id, {
      status: "pending",
      evidence: [
        ...task.evidence,
        `recovered: interrupted at action ${resumeFrom}/${task.actions.length}, ${remaining.length} actions remaining`,
      ],
    });

    recovered++;
    details.push(`[recovered] ${task.title} — resume from action ${resumeFrom}/${task.actions.length}`);
  }

  recordRuntimeEvent("task_recovery", `recovered=${recovered} failed=${failed} total_interrupted=${interrupted.length}`);

  return { recovered, failed, total: interrupted.length, details };
}

export function getRecoverySummary(): string {
  const all = getAllTasks();
  if (all.length === 0) return "No tasks to recover.";

  const interrupted = all.filter(t => t.status === "running" || t.status === "retrying");
  if (interrupted.length === 0) return "No interrupted tasks.";

  return interrupted.map(t => {
    const progress = t.actions.length > 0
      ? Math.round(t.actions.filter(a => a.status === "done").length / t.actions.length * 100)
      : 0;
    return `  ${t.title} — ${progress}% — ${t.actions.filter(a => a.status === "done").length}/${t.actions.length} actions done`;
  }).join("\n");
}
