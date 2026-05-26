import type { BrowserPlan, BrowserTaskResult } from "./browser-types.js";

export interface QueuedTask {
  id: string;
  plan: BrowserPlan;
  enqueuedAt: number;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  result?: BrowserTaskResult;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

const queue: QueuedTask[] = [];
const MAX_QUEUE = 50;

function generateTaskId(): string {
  return `btq_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function enqueueBrowserTask(plan: BrowserPlan): QueuedTask {
  if (queue.length >= MAX_QUEUE) throw new Error("Browser task queue full");

  const task: QueuedTask = {
    id: generateTaskId(),
    plan,
    enqueuedAt: Date.now(),
    status: "queued",
  };

  queue.push(task);
  return task;
}

export function dequeueBrowserTask(): QueuedTask | undefined {
  const idx = queue.findIndex(t => t.status === "queued");
  if (idx < 0) return undefined;
  const task = queue[idx];
  task.status = "running";
  task.startedAt = Date.now();
  return task;
}

export function completeBrowserTask(taskId: string, result: BrowserTaskResult): void {
  const task = queue.find(t => t.id === taskId);
  if (!task) return;
  task.status = "completed";
  task.result = result;
  task.completedAt = Date.now();
}

export function failBrowserTask(taskId: string, error: string): void {
  const task = queue.find(t => t.id === taskId);
  if (!task) return;
  task.status = "failed";
  task.error = error;
  task.completedAt = Date.now();
}

export function cancelBrowserTask(taskId: string): void {
  const task = queue.find(t => t.id === taskId);
  if (!task) return;
  task.status = "cancelled";
  task.completedAt = Date.now();
}

export function getBrowserTask(taskId: string): QueuedTask | undefined {
  return queue.find(t => t.id === taskId);
}

export function getQueuedTasks(): QueuedTask[] {
  return queue.filter(t => t.status === "queued");
}

export function getRunningTasks(): QueuedTask[] {
  return queue.filter(t => t.status === "running");
}

export function getCompletedTasks(): QueuedTask[] {
  return queue.filter(t => t.status === "completed");
}

export function getAllBrowserTasks(): QueuedTask[] {
  return [...queue];
}

export function getBrowserQueueLength(): number {
  return queue.filter(t => t.status === "queued").length;
}

export function queueSummary(): string {
  const queued = getQueuedTasks().length;
  const running = getRunningTasks().length;
  const completed = getCompletedTasks().length;
  const failed = queue.filter(t => t.status === "failed").length;
  return `Browser tasks: ${queue.length} total (${queued} queued, ${running} running, ${completed} completed, ${failed} failed)`;
}
