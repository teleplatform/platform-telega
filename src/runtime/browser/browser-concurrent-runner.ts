import type { BrowserPlan, BrowserTaskResult } from "./browser-types.js";
import { createSession, getPageForSession, closeSession, releaseSession, assignTaskToSession, sessionStats } from "./browser-session-manager.js";
import { enqueueBrowserTask, dequeueBrowserTask, completeBrowserTask, failBrowserTask, getRunningTasks, getQueuedTasks } from "./browser-task-queue.js";
import { getResourceLimits, recordResourceUsage } from "./browser-resource-limits.js";
import { runBrowserPlan } from "./browser-task-runner.js";
import { recordBrowserTaskEvidence } from "./browser-evidence-record.js";
import { registerScreenshots } from "./browser-artifact-registry.js";
import { buildRunTrace } from "./browser-run-trace.js";
import { classifyTaskEffect } from "./browser-effect-classifier.js";
import { createMissionSummary, emitBrowserMissionEvent } from "./browser-mission-summary.js";
import { recordOperation } from "../memory/operational-memory.js";

let running = false;
let loopTimer: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 500;

async function processQueue(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const limits = getResourceLimits();
    const runningTasks = getRunningTasks().length;

    while (runningTasks < limits.maxConcurrentTasks) {
      const task = dequeueBrowserTask();
      if (!task) break;

      executeTask(task).catch(err => {
        failBrowserTask(task.id, err instanceof Error ? err.message : String(err));
        running = false;
      });
    }
  } finally {
    running = false;
  }
}

async function executeTask(task: { id: string; plan: BrowserPlan }): Promise<void> {
  let sessionId: string | undefined;

  try {
    recordOperation("browser_concurrent_start", task.plan.intent);

    const session = await createSession(`task_${task.id}`, task.plan.id);
    sessionId = session.id;
    assignTaskToSession(session.id, task.id);

    const limits = getResourceLimits();
    const timeout = setTimeout(() => {
      failBrowserTask(task.id, `Task timeout after ${limits.taskTimeoutMs}ms`);
      if (sessionId) closeSession(sessionId);
    }, limits.taskTimeoutMs);

    const result = await runBrowserPlan(task.plan);

    clearTimeout(timeout);

    await recordBrowserTaskEvidence(result);
    registerScreenshots(result, "final");

    const trace = buildRunTrace(result);
    recordOperation("browser_concurrent_complete", `${task.plan.intent}: ${trace.allVerified ? "verified" : "failed"}`);

    completeBrowserTask(task.id, result);

    await emitBrowserMissionEvent(result);
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    failBrowserTask(task.id, errMsg);
    recordOperation("browser_concurrent_failed", `${task.plan.intent}: ${errMsg}`);
  } finally {
    if (sessionId) {
      releaseSession(sessionId);
    }
    recordResourceUsage({ activeSessions: sessionStats().active });
  }
}

export function startConcurrentRunner(): void {
  if (loopTimer) return;
  loopTimer = setInterval(processQueue, POLL_INTERVAL_MS);
}

export function stopConcurrentRunner(): void {
  if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
}

export async function submitAndRun(plan: BrowserPlan): Promise<string> {
  const task = enqueueBrowserTask(plan);
  processQueue().catch(() => {});
  return task.id;
}

export function getConcurrentRunnerStatus(): { running: boolean; queueLength: number; activeTasks: number; sessions: ReturnType<typeof sessionStats> } {
  return {
    running,
    queueLength: getQueuedTasks().length,
    activeTasks: getRunningTasks().length,
    sessions: sessionStats(),
  };
}
