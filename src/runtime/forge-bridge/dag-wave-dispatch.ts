import type { ReadyQueueSnapshot, ReadyQueueItem } from "./dag-ready-queue-scheduler.js";
import type { TaskGroup } from "./task-group-types.js";
import { getTaskGroupStore } from "./task-group-store.js";
import { emitGroupEvent } from "./task-group-stream-store.js";

export const MAX_CONCURRENCY = 2;

export interface WaveDispatchResult {
  group_id: string;
  wave_sequence: number;
  dispatched_tasks: ReadyQueueItem[];
  skipped_tasks: string[];
  summary: string;
  started_at: string;
  completed_at?: string;
}

export function buildAndDispatchWave(group_id: string, maxConcurrency: number = MAX_CONCURRENCY): Promise<WaveDispatchResult> {
  const startedAt = new Date().toISOString();
  const store = getTaskGroupStore();
  
  return store.evaluateTaskReadiness(group_id).then(evaluations => {
    const readyItems: ReadyQueueItem[] = [];
    const blocked: string[] = [];
    const failed: string[] = [];
    
    for (let i = 0; i < evaluations.length; i++) {
      const evalItem = evaluations[i];
      if (!evalItem) continue;
      
      const item: ReadyQueueItem = {
        group_id,
        task_id: evalItem.task_id,
        priority: i,
        ready_at: startedAt,
        blocked_by: evalItem.blocking_tasks ?? [],
        index: i,
      };
      
      switch (evalItem.readiness) {
        case "ready":
          readyItems.push(item);
          break;
        case "blocked":
          blocked.push(evalItem.task_id);
          break;
        case "failed":
          failed.push(evalItem.task_id);
          break;
      }
    }
    
    readyItems.sort((a, b) => a.index - b.index);
    
    const snapshot: ReadyQueueSnapshot = {
      group_id,
      ready: readyItems,
      blocked,
      failed,
      created_at: startedAt,
    };
    
    emitGroupEvent(group_id, "dag_wave_started", {
      ready_count: snapshot.ready.length,
      blocked_count: snapshot.blocked.length,
      failed_count: snapshot.failed.length,
    });
    
    const dispatched = snapshot.ready.slice(0, maxConcurrency);
    const skipped = snapshot.ready.slice(maxConcurrency).map(r => r.task_id);
    
    dispatched.forEach(item => {
      emitGroupEvent(group_id, "child_task_started", { task_id: item.task_id });
    });
    
    emitGroupEvent(group_id, "dag_wave_completed", {
      dispatched_count: dispatched.length,
      skipped_count: skipped.length,
    });
    
    return {
      group_id,
      wave_sequence: 1,
      dispatched_tasks: dispatched,
      skipped_tasks: skipped,
      summary: `Wave dispatched: ${dispatched.length} tasks, ${skipped.length} skipped`,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };
  });
}

export function dispatchNextWave(group_id: string): Promise<WaveDispatchResult> {
  return buildAndDispatchWave(group_id).then(result => {
    const store = getTaskGroupStore();
    return store.evaluateTaskReadiness(group_id).then(_reevaluated => result);
  });
}