import { buildAndDispatchWave, type WaveDispatchResult } from "./dag-wave-dispatch.js";
import { getTaskGroupStore } from "./task-group-store.js";
import { emitGroupEvent } from "./task-group-stream-store.js";
import type { TaskGroupStatus, TaskReadinessEvaluation } from "./task-group-types.js";
import { SchedulerPersistence } from "./scheduler-persistence.js";
import type Database from "better-sqlite3";
import {
  createSchedulerRun,
  appendWaveEvent,
  completeSchedulerRun,
  setSchedulerRunStorePersistence,
  getGovernanceState,
  listIncompleteSchedulerRuns,
  clearSchedulerGovernance,
  getSchedulerRun,
} from "./scheduler-run-store.js";

export const MAX_WAVE_ITERATIONS = 100;
export const DEFAULT_WAVE_TIMEOUT_MS = 30000;

let schedulerPersistence: SchedulerPersistence | null = null;

export function getSchedulerPersistence(): SchedulerPersistence | null {
  return schedulerPersistence;
}

export function setSchedulerPersistence(db: Database.Database): void {
  schedulerPersistence = new SchedulerPersistence(db);
  schedulerPersistence.initSchema();
  setSchedulerRunStorePersistence(schedulerPersistence);
}

export interface WaveSchedulerLoopOptions {
  maxIterations?: number;
  waveTimeoutMs?: number;
  run_id?: string;
  onWaveComplete?: (result: WaveDispatchResult, iteration: number, run_id: string) => void | Promise<void>;
}

export interface SchedulerRunResult {
  run_id: string;
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
      await options.onWaveComplete(waveResult, wavesRun, "");
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
  const run_id = `sched_${group_id}_${Date.now()}`;
  const startedAt = new Date().toISOString();
  const store = getTaskGroupStore();

  emitGroupEvent(group_id, "scheduler_run_started", { run_id, group_id, started_at: startedAt });

  await createSchedulerRun(run_id, group_id, "running");

  const completedTasks: string[] = [];
  const failedTasks: string[] = [];
  const blockedTasks: string[] = [];
  let wavesRun = 0;

  for (let i = 0; i < maxIterations; i++) {
    const governance = await getGovernanceState(run_id);

    if (governance === "cancelled") {
      const group = await store.get(group_id);
      if (group) {
        await store.updateStatus(group_id, "cancelled");
      }

      await completeSchedulerRun(
        run_id,
        group?.group_status ?? "cancelled",
        wavesRun,
        completedTasks.length,
        completedTasks.length,
        failedTasks.length,
        blockedTasks.length,
        "cancelled"
      );

      emitGroupEvent(group_id, "scheduler_run_cancelled", { run_id, waves_run: wavesRun });

      return {
        run_id,
        group_id,
        status: group?.group_status ?? "cancelled",
        waves_run: wavesRun,
        tasks_dispatched: completedTasks.length,
        tasks_completed: completedTasks,
        tasks_failed: failedTasks,
        tasks_blocked: blockedTasks,
        stopped_reason: "cancelled",
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      };
    }

    if (governance === "paused") {
      await completeSchedulerRun(
        run_id,
        "paused",
        wavesRun,
        completedTasks.length,
        completedTasks.length,
        failedTasks.length,
        blockedTasks.length,
        "cancelled"
      );

      return {
        run_id,
        group_id,
        status: "paused",
        waves_run: wavesRun,
        tasks_dispatched: completedTasks.length,
        tasks_completed: completedTasks,
        tasks_failed: failedTasks,
        tasks_blocked: blockedTasks,
        stopped_reason: "cancelled",
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      };
    }

    if (governance === "needs_creator") {
      const group = await store.get(group_id);

      if (group) {
        await store.updateStatus(group_id, "needs_creator");
      }

      await completeSchedulerRun(
        run_id,
        "needs_creator",
        wavesRun,
        completedTasks.length,
        completedTasks.length,
        failedTasks.length,
        blockedTasks.length,
        "cancelled"
      );

      emitGroupEvent(group_id, "group_needs_creator", { run_id, waves_run: wavesRun });

      return {
        run_id,
        group_id,
        status: "needs_creator",
        waves_run: wavesRun,
        tasks_dispatched: completedTasks.length,
        tasks_completed: completedTasks,
        tasks_failed: failedTasks,
        tasks_blocked: blockedTasks,
        stopped_reason: "cancelled",
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      };
    }

    wavesRun = i + 1;
    const evaluations = await store.evaluateTaskReadiness(group_id);

    const readyCount = evaluations.filter(e => e.readiness === "ready").length;

    if (readyCount === 0) {
      const group = await store.get(group_id);
      const hasFailures = evaluations.some(e => e.readiness === "failed");
      const finalStatus = hasFailures ? "failed" : "done";

      if (group) {
        await store.updateStatus(group_id, finalStatus);
      }

      await completeSchedulerRun(
        run_id,
        finalStatus,
        wavesRun,
        completedTasks.length,
        completedTasks.length,
        failedTasks.length,
        blockedTasks.length,
        "completed"
      );

      if (hasFailures) {
        emitGroupEvent(group_id, "scheduler_run_failed", { run_id, finalStatus, waves_run: wavesRun });
      } else {
        emitGroupEvent(group_id, "scheduler_run_completed", { run_id, waves_run: wavesRun });
      }

      return {
        run_id,
        group_id,
        status: finalStatus,
        waves_run: wavesRun,
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

    await appendWaveEvent(run_id, wavesRun, "wave_dispatched", {
      dispatched_task_ids: waveResult.dispatched_tasks.map(t => t.task_id),
    });

    emitGroupEvent(group_id, "scheduler_wave_completed", {
      run_id,
      wave_index: wavesRun,
      dispatched_count: waveResult.dispatched_tasks.length,
    });

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
      await options.onWaveComplete(waveResult, wavesRun, run_id);
    }
  }

  await completeSchedulerRun(
    run_id,
    "running",
    wavesRun,
    completedTasks.length,
    completedTasks.length,
    failedTasks.length,
    blockedTasks.length,
    "max_iterations"
  );

  return {
    run_id,
    group_id,
    status: "running",
    waves_run: wavesRun,
    tasks_dispatched: completedTasks.length,
    tasks_completed: completedTasks,
    tasks_failed: failedTasks,
    tasks_blocked: blockedTasks,
    stopped_reason: "max_iterations",
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  };
}

export interface ResumeRecoveryResult {
  resumed_runs: string[];
  skipped_paused: string[];
  skipped_cancelled: string[];
  skipped_needs_creator: string[];
  errors: string[];
}

export async function resumeIncompleteSchedulerRuns(): Promise<ResumeRecoveryResult> {
  const incomplete = await listIncompleteSchedulerRuns();

  const result: ResumeRecoveryResult = {
    resumed_runs: [],
    skipped_paused: [],
    skipped_cancelled: [],
    skipped_needs_creator: [],
    errors: [],
  };

  for (const run of incomplete) {
    try {
      const persistedRun = await getSchedulerRun(run.run_id);
      const governance = persistedRun?.governance_state as string | undefined;

      if (governance === "paused") {
        result.skipped_paused.push(run.run_id);
      } else if (governance === "cancelled") {
        result.skipped_cancelled.push(run.run_id);
      } else if (governance === "needs_creator") {
        result.skipped_needs_creator.push(run.run_id);
      } else {
        await clearSchedulerGovernance(run.run_id);
        result.resumed_runs.push(run.run_id);
      }
    } catch (e: any) {
      result.errors.push(`${run.run_id}: ${e.message}`);
    }
  }

  return result;
}