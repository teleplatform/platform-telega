import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { getAccountLabel, canUseDangerousFeature } from "./bot.js";
import { createPatchPlan, previewPatch, applyPatch, verifyApply, rollbackApply } from "./kilo-controlled-write.js";
import { logKiloExecution } from "./kilo-live.js";
import fs from "fs/promises";
import path from "path";

const FORGE_DIR = path.join(process.cwd(), "data/forge");
const TASKS_FILE = path.join(FORGE_DIR, "tasks.jsonl");
const MAX_TASKS = 100;

export type ForgeTaskStatus = "planned" | "awaiting_approval" | "applying" | "verified" | "failed" | "rolled_back";

export interface ForgeTask {
  forge_task_id: string;
  user_id: string;
  account_label: string;
  title: string;
  task: string;
  status: ForgeTaskStatus;
  patch_plan_id?: string;
  apply_id?: string;
  evidence_refs: string[];
  error?: string;
  created_at: number;
  updated_at: number;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(FORGE_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createForgeTask(
  userId: string,
  accountLabel: string,
  title: string,
  taskDescription: string,
  lang: Language
): Promise<{ task_id?: string; error?: string }> {
  await ensureDir();

  const taskId = makeId("forge");

  console.log("[forge] creating task", { user_id: userId, label: accountLabel, task: taskDescription.slice(0, 50) });

  const task: ForgeTask = {
    forge_task_id: taskId,
    user_id: userId,
    account_label: accountLabel,
    title,
    task: taskDescription,
    status: "planned",
    evidence_refs: [],
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const line = JSON.stringify(task) + "\n";
  await fs.appendFile(TASKS_FILE, line, "utf-8");

  await logKiloExecution(userId, accountLabel, "forge_task_created", { task_id: taskId }, "completed");

  return { task_id: taskId };
}

export async function getForgeTask(taskId: string): Promise<ForgeTask | null> {
  try {
    await ensureDir();
    const content = await fs.readFile(TASKS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const task = JSON.parse(line) as ForgeTask;
        if (task.forge_task_id === taskId) {
          return task;
        }
      } catch {}
    }
  } catch {}
  return null;
}

export async function updateForgeTask(taskId: string, updates: Partial<ForgeTask>): Promise<boolean> {
  try {
    await ensureDir();
    const content = await fs.readFile(TASKS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const tasks: ForgeTask[] = [];

    for (const line of lines) {
      try {
        const task = JSON.parse(line) as ForgeTask;
        if (task.forge_task_id === taskId) {
          Object.assign(task, updates, { updated_at: Date.now() });
        }
        tasks.push(task);
      } catch {}
    }

    const newContent = tasks.map(t => JSON.stringify(t)).join("\n") + "\n";
    await fs.writeFile(TASKS_FILE, newContent, "utf-8");

    return true;
  } catch (e) {
    console.error("[forge] update task failed", e);
    return false;
  }
}

export async function listForgeTasks(
  userId: string,
  accountLabel: string,
  limit = 20,
  status?: ForgeTaskStatus
): Promise<ForgeTask[]> {
  const tasks: ForgeTask[] = [];

  try {
    await ensureDir();
    const content = await fs.readFile(TASKS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-MAX_TASKS);

    for (const line of lines) {
      try {
        const task = JSON.parse(line) as ForgeTask;
        if (!status || task.status === status) {
          tasks.push(task);
        }
      } catch {}
    }
  } catch {}

  return tasks.sort((a, b) => b.updated_at - a.updated_at).slice(0, limit);
}

export async function deleteForgeTask(taskId: string): Promise<boolean> {
  try {
    await ensureDir();
    const content = await fs.readFile(TASKS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const filtered = lines.filter(line => {
      try {
        const task = JSON.parse(line) as ForgeTask;
        return task.forge_task_id !== taskId;
      } catch {
        return true;
      }
    });

    await fs.writeFile(TASKS_FILE, filtered.join("\n") + "\n", "utf-8");
    return true;
  } catch (e) {
    return false;
  }
}

export async function handleForgeTask(
  taskId: string,
  userId: string,
  accountLabel: string,
  lang: Language
): Promise<{ ok: boolean; error?: string }> {
  const task = await getForgeTask(taskId);

  if (!task) {
    return { ok: false, error: lang === "ru" ? "Task не найден" : "Task not found" };
  }

  console.log("[forge] executing task", { task_id: taskId, label: accountLabel });

  await updateForgeTask(taskId, { status: "awaiting_approval" });

  const planResult = await createPatchPlan(userId, accountLabel, task.task, lang);

  if (planResult.error) {
    await updateForgeTask(taskId, { status: "failed", error: planResult.error });
    return { ok: false, error: planResult.error };
  }

  await updateForgeTask(taskId, { patch_plan_id: planResult.plan_id });

  const canApply = accountLabel === "★" || accountLabel === "★★";
  if (!canApply) {
    await updateForgeTask(taskId, { status: "awaiting_approval" });
    return {
      ok: true,
      error: lang === "ru"
        ? "Patch план создан. Ожидает одобрения ★/★★★"
        : "Patch plan created. Awaiting ★/★★ approval"
    };
  }

  await updateForgeTask(taskId, { status: "applying" });

  const applyResult = await applyPatch(planResult.plan_id!, userId, accountLabel, lang);

  if (!applyResult.ok) {
    await updateForgeTask(taskId, { status: "failed", error: applyResult.error });
    return { ok: false, error: applyResult.error };
  }

  await updateForgeTask(taskId, {
    status: "verified",
    apply_id: applyResult.apply_id,
    evidence_refs: [...task.evidence_refs, applyResult.apply_id!],
  });

  await logKiloExecution(userId, accountLabel, "forge_task_completed", { task_id: taskId }, "completed");

  return { ok: true };
}

export function formatForgeTask(task: ForgeTask, lang: Language = "ru"): string {
  const statusIcon = {
    planned: "📋",
    awaiting_approval: "⏳",
    applying: "🔧",
    verified: "✅",
    failed: "❌",
    rolled_back: "↩️",
  }[task.status];

  const statusText = {
    planned: lang === "ru" ? "Запланирован" : "Planned",
    awaiting_approval: lang === "ru" ? "Ожидает одобрения" : "Awaiting approval",
    applying: lang === "ru" ? "Применяется" : "Applying",
    verified: lang === "ru" ? "Проверен" : "Verified",
    failed: lang === "ru" ? "Ошибка" : "Failed",
    rolled_back: lang === "ru" ? "Откачен" : "Rolled back",
  }[task.status];

  const lines = [
    `${statusIcon} Forge #${task.forge_task_id.slice(-8)}`,
    `Title: ${task.title}`,
    `Status: ${statusText}`,
    `Created: ${new Date(task.created_at).toLocaleString()}`,
  ];

  if (task.patch_plan_id) {
    lines.push(`Patch: ${task.patch_plan_id}`);
  }
  if (task.apply_id) {
    lines.push(`Apply: ${task.apply_id}`);
  }
  if (task.error) {
    lines.push(`Error: ${task.error}`);
  }

  return lines.join("\n");
}

export function formatForgeTaskList(tasks: ForgeTask[], lang: Language = "ru"): string {
  if (tasks.length === 0) {
    return lang === "ru" ? "Нет tasks" : "No tasks";
  }

  const lines = [lang === "ru" ? "🔨 Forge Tasks:" : "🔨 Forge Tasks:"];

  for (const task of tasks.slice(0, 10)) {
    const statusIcon = {
      planned: "📋",
      awaiting_approval: "⏳",
      applying: "🔧",
      verified: "✅",
      failed: "❌",
      rolled_back: "↩️",
    }[task.status];
    lines.push(`${statusIcon} #${task.forge_task_id.slice(-8)} | ${task.title.slice(0, 30)}...`);
  }

  return lines.join("\n");
}

export async function canManageForgeTask(accountLabel: string): Promise<{ create: boolean; apply: boolean; rollback: boolean }> {
  const isOwner = accountLabel === "★" || accountLabel === "★★";
  const isPartner = accountLabel === "★★★";

  return {
    create: isOwner || isPartner,
    apply: isOwner,
    rollback: isOwner,
  };
}