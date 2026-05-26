import fs from "node:fs";
import path from "node:path";
import type { ExecutableTask } from "./execution-types.js";

const TASKS_DIR = ".data/runtime/tasks";

let tasks: ExecutableTask[] = [];
let loaded = false;

function getFilePath(): string {
  return path.join(process.cwd(), TASKS_DIR, "tasks.json");
}

function ensureDir(): void {
  const dir = path.join(process.cwd(), TASKS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadTasks(): void {
  const filePath = getFilePath();
  ensureDir();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      tasks = JSON.parse(raw) as ExecutableTask[];
    } catch { tasks = []; }
  } else { tasks = []; }
  loaded = true;
}

function saveTasks(): void {
  const filePath = getFilePath();
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2), "utf-8");
}

export function getAllTasks(): ExecutableTask[] {
  if (!loaded) loadTasks();
  return [...tasks];
}

export function getTask(id: string): ExecutableTask | undefined {
  if (!loaded) loadTasks();
  return tasks.find(t => t.id === id);
}

export function addTask(task: ExecutableTask): void {
  if (!loaded) loadTasks();
  tasks.push(task);
  saveTasks();
}

export function updateTask(id: string, updates: Partial<ExecutableTask>): ExecutableTask | undefined {
  if (!loaded) loadTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx < 0) return undefined;
  tasks[idx] = { ...tasks[idx], ...updates, updatedAt: Date.now() };
  saveTasks();
  return tasks[idx];
}

export function deleteTask(id: string): void {
  if (!loaded) loadTasks();
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
}

export function getTasksByStatus(status: string): ExecutableTask[] {
  return getAllTasks().filter(t => t.status === status);
}

export function getPendingTasks(): ExecutableTask[] {
  return getAllTasks().filter(t => t.status === "pending" || t.status === "retrying");
}

export function getRunningTasks(): ExecutableTask[] {
  return getAllTasks().filter(t => t.status === "running");
}

export function getInterruptedTasks(): ExecutableTask[] {
  return getAllTasks().filter(t => t.status === "running" || t.status === "retrying");
}

export function taskSummary(): string {
  const all = getAllTasks();
  if (all.length === 0) return "No tasks.";
  const pending = all.filter(t => t.status === "pending").length;
  const running = all.filter(t => t.status === "running").length;
  const done = all.filter(t => t.status === "done").length;
  const failed = all.filter(t => t.status === "failed").length;
  const lines: string[] = [`Tasks: ${all.length} total (${pending} pending, ${running} running, ${done} done, ${failed} failed)`];
  for (const t of all.slice(0, 5)) {
    const progress = t.actions.length > 0 ? Math.round(t.actions.filter(a => a.status === "done").length / t.actions.length * 100) : 0;
    lines.push(`  [${t.status}] ${t.title} (${progress}%)`);
  }
  return lines.join("\n");
}
