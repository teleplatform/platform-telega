import fs from "node:fs";
import path from "node:path";
import type { RuntimeGoal } from "./goal-types.js";

const GOALS_DIR = ".data/runtime/goals";

let goals: RuntimeGoal[] = [];
let loaded = false;

function getFilePath(): string {
  return path.join(process.cwd(), GOALS_DIR, "goals.json");
}

function ensureDir(): void {
  const dir = path.join(process.cwd(), GOALS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadGoals(): void {
  const filePath = getFilePath();
  ensureDir();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      goals = JSON.parse(raw) as RuntimeGoal[];
    } catch {
      goals = [];
    }
  } else {
    goals = [];
  }
  loaded = true;
}

export function saveGoals(): void {
  const filePath = getFilePath();
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(goals, null, 2), "utf-8");
}

export function getAllGoals(): RuntimeGoal[] {
  if (!loaded) loadGoals();
  return [...goals];
}

export function getGoal(id: string): RuntimeGoal | undefined {
  if (!loaded) loadGoals();
  return goals.find(g => g.id === id);
}

export function addGoal(goal: RuntimeGoal): void {
  if (!loaded) loadGoals();
  goals.push(goal);
  saveGoals();
}

export function updateGoal(id: string, updates: Partial<RuntimeGoal>): RuntimeGoal | undefined {
  if (!loaded) loadGoals();
  const idx = goals.findIndex(g => g.id === id);
  if (idx < 0) return undefined;
  goals[idx] = { ...goals[idx], ...updates, updatedAt: Date.now() };
  saveGoals();
  return goals[idx];
}

export function deleteGoal(id: string): void {
  if (!loaded) loadGoals();
  goals = goals.filter(g => g.id !== id);
  saveGoals();
}

export function getGoalsByStatus(status: string): RuntimeGoal[] {
  return getAllGoals().filter(g => g.status === status);
}

export function getActiveGoals(): RuntimeGoal[] {
  return getAllGoals().filter(g => g.status === "active" || g.status === "paused");
}

export function getAbandonedGoals(): RuntimeGoal[] {
  return getAllGoals().filter(g => g.status === "abandoned" || (g.status === "active" && isStale(g)));
}

function isStale(goal: RuntimeGoal): boolean {
  const hours = (Date.now() - goal.updatedAt) / (1000 * 60 * 60);
  return hours > 72;
}

export function goalSummary(): string {
  const all = getAllGoals();
  if (all.length === 0) return "No goals.";
  const active = all.filter(g => g.status === "active");
  const paused = all.filter(g => g.status === "paused");
  const abandoned = all.filter(g => g.status === "abandoned" || (g.status === "active" && isStale(g)));
  const completed = all.filter(g => g.status === "completed");
  const lines: string[] = [
    `Goals: ${all.length} total, ${active.length} active, ${paused.length} paused, ${abandoned.length} abandoned, ${completed.length} completed`,
  ];
  for (const g of active.slice(0, 5)) {
    lines.push(`  [${g.priority}] ${g.title} (${g.progress}%) — next: ${g.nextStep}`);
  }
  return lines.join("\n");
}
