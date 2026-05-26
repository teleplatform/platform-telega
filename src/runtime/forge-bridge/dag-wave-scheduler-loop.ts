import { buildAndDispatchWave, type WaveDispatchResult } from "./dag-wave-dispatch.js";
import { getTaskGroupStore } from "./task-group-store.js";
import { emitGroupEvent } from "./task-group-stream-store.js";
import type { TaskGroupStatus } from "./task-group-types.js";

export const MAX_WAVE_ITERATIONS = 100;
export const DEFAULT_WAVE_TIMEOUT_MS = 30000;

export interface WaveSchedulerLoopOptions {
  maxIterations?: number;
  waveTimeoutMs?: number;
  onWaveComplete?: (result: WaveDispatchResult, iteration: number) => void;
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
  let totalDispatched = 0;
  let iterations = 0;

  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;
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
          total_iterations: iterations,
          total_tasks_dispatched: totalDispatched,
          final_status: finalStatus,
          stopped_reason: "completed",
        };
      }
      return {
        group_id,
        total_iterations: iterations,
        total_tasks_dispatched: totalDispatched,
        final_status: "done",
        stopped_reason: "no_ready_tasks",
      };
    }

    const waveResult = await buildAndDispatchWave(group_id, 2);
    totalDispatched += waveResult.dispatched_tasks.length;
    
    if (options.onWaveComplete) {
      options.onWaveComplete(waveResult, iterations);
    }
  }

  const group = await store.get(group_id);
  return {
    group_id,
    total_iterations: iterations,
    total_tasks_dispatched: totalDispatched,
    final_status: group?.group_status ?? "running",
    stopped_reason: "max_iterations",
  };
}