import { buildAndDispatchWave, type WaveDispatchResult } from "./dag-wave-dispatch.js";
import { getTaskGroupStore } from "./task-group-store.js";
import { emitGroupEvent } from "./task-group-stream-store.js";
import type { TaskGroupStatus, TaskReadinessEvaluation } from "./task-group-types.js";

export const MAX_WAVE_ITERATIONS = 100;
export const DEFAULT_WAVE_TIMEOUT_MS = 30000;

export interface WaveSchedulerLoopOptions {
  maxIterations?: number;
  waveTimeoutMs?: number;
  onWaveComplete?: (result: WaveDispatchResult, iteration: number) => void;
}

export interface SchedulerRunResult {
  group_id: string;
  status: TaskGroupStatus;
  waves_run: number;
  tasks_dispatched: number;
  tasks_completed: string[];
  tasks_failed: string[];
  tasks_blocked: string[];
  stopped_reason: "completed" | "max_iterations" | "no_ready_tasks" | "cancelled";
  started_at: string;
  completed_at: string;
}

export interface WaveSchedulerLoopResult {
  group_id: string;
  total_iterations: number;
  total_tasks_dispatched: number;
  final_status: TaskGroupStatus;
  stopped_reason: "completed" | "max_iterations" | "needs_creator" | "all_done" | "no_ready_tasks" | "cancelled";
}

export async function runWaveSchedulerLoop(
  group_id: string,
  options: WaveSchedulerLoopOptions = {}
): Promise<WaveSchedulerLoopResult> {
  const maxIterations = options.maxIterations ?? MAX_WAVE_ITERATIONS;
  const store = getTaskGroupStore();
  const startedAt = new Date().toISOString();
  let totalDispatched = 0;
  let wavesRun = 0;

  for (let i = 0; i < maxIterations; i++) {
    wavesRun = i + 1;
    const evaluations = await store.evaluateTaskReadiness(group_id);
    
    const readyCount = evaluations.filter(e => e.readiness === "ready").length;
    
    if (readyCount === 0) {
      const group = await store.get(group_id);
      
      if (group) {
        const hasFailures = evaluations.some(e => e.readiness === "failed");
        const finalStatus = hasFailures ? "failed" : "done";
        await store.updateStatus(group_id, finalStatus);
        if (hasFailures) {
          emitGroupEvent(group_id, "group_failed", { reason: "task_failed" });
        }
        return {
          group_id,
          total_iterations: wavesRun,
          total_tasks_dispatched: totalDispatched,
          final_status: finalStatus,
          stopped_reason: "completed",
        };
      }
      return {
        group_id,
        total_iterations: wavesRun,
        total_tasks_dispatched: totalDispatched,
        final_status: "done",
        stopped_reason: "no_ready_tasks",
      };
    }

    const waveResult = await buildAndDispatchWave(group_id, 2);
    totalDispatched += waveResult.dispatched_tasks.length;
    
    if (options.onWaveComplete) {
      options.onWaveComplete(waveResult, wavesRun);
    }
  }

  const group = await store.get(group_id);
  return {
    group_id,
    total_iterations: wavesRun,
    total_tasks_dispatched: totalDispatched,
    final_status: group?.group_status ?? "running",
    stopped_reason: "max_iterations",
  };
}

export async function runScheduler(group_id: string, options: WaveSchedulerLoopOptions = {}): Promise<SchedulerRunResult> {
  const maxIterations = options.maxIterations ?? MAX_WAVE_ITERATIONS;
  const startedAt = new Date().toISOString();
  const store = getTaskGroupStore();
  
  const completedTasks: string[] = [];
  const failedTasks: string[] = [];
  const blockedTasks: string[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const evaluations = await store.evaluateTaskReadiness(group_id);
    
    const readyCount = evaluations.filter(e => e.readiness === "ready").length;
    
    if (readyCount === 0) {
      const group = await store.get(group_id);
      const hasFailures = evaluations.some(e => e.readiness === "failed");
      const finalStatus = hasFailures ? "failed" : "done";
      
      if (group) {
        await store.updateStatus(group_id, finalStatus);
      }
      
      return {
        group_id,
        status: finalStatus,
        waves_run: i,
        tasks_dispatched: completedTasks.length,
        tasks_completed: completedTasks,
        tasks_failed: failedTasks,
        tasks_blocked: blockedTasks,
        stopped_reason: "completed",
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      };
    }

    const waveResult = await buildAndDispatchWave(group_id, 2);
    completedTasks.push(...waveResult.dispatched_tasks.map(t => t.task_id));
    
    const currentEval = await store.evaluateTaskReadiness(group_id);
    for (const e of currentEval) {
      if (e.readiness === "failed" && !failedTasks.includes(e.task_id)) {
        failedTasks.push(e.task_id);
      }
      if (e.readiness === "blocked" && !blockedTasks.includes(e.task_id)) {
        blockedTasks.push(e.task_id);
      }
    }
    
    if (options.onWaveComplete) {
      options.onWaveComplete(waveResult, i + 1);
    }
  }

  return {
    group_id,
    status: "running",
    waves_run: maxIterations,
    tasks_dispatched: completedTasks.length,
    tasks_completed: completedTasks,
    tasks_failed: failedTasks,
    tasks_blocked: blockedTasks,
    stopped_reason: "max_iterations",
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  };
}