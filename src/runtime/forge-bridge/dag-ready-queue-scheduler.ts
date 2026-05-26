import type { TaskReadiness, TaskReadinessEvaluation } from "./task-group-types.js";

export interface ReadyQueueItem {
  group_id: string;
  task_id: string;
  priority: number;
  ready_at: string;
  blocked_by: string[];
  index: number;
}

export interface ReadyQueueSnapshot {
  group_id: string;
  ready: ReadyQueueItem[];
  blocked: string[];
  failed: string[];
  created_at: string;
}

export interface ReadyQueueScheduler {
  buildReadyQueue(group_id: string, evaluations: TaskReadinessEvaluation[]): Promise<ReadyQueueSnapshot>;
}

export function getReadyQueueScheduler(): ReadyQueueScheduler {
  return scheduler;
}

const scheduler: ReadyQueueScheduler = {
  async buildReadyQueue(group_id, evaluations) {
    const now = new Date().toISOString();
    
    const readyTasks: ReadyQueueItem[] = [];
    const blockedTasks: string[] = [];
    const failedTasks: string[] = [];

    for (let i = 0; i < evaluations.length; i++) {
      const evalItem = evaluations[i];
      if (!evalItem) continue;

      const item: ReadyQueueItem = {
        group_id,
        task_id: evalItem.task_id,
        priority: i,
        ready_at: now,
        blocked_by: evalItem.blocking_tasks ?? [],
        index: i,
      };

      switch (evalItem.readiness) {
        case "ready":
          readyTasks.push(item);
          break;
        case "blocked":
          blockedTasks.push(evalItem.task_id);
          break;
        case "failed":
          failedTasks.push(evalItem.task_id);
          break;
      }
    }

    readyTasks.sort((a, b) => a.index - b.index);

    return {
      group_id,
      ready: readyTasks,
      blocked: blockedTasks,
      failed: failedTasks,
      created_at: now,
    };
  }
};