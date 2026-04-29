import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { getAccountLabel, canUseDangerousFeature } from "./bot.js";
import { callMCPTool } from "./mcp-bridge.js";
import { logKiloExecution } from "./kilo-live.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const PATCH_DIR = path.join(process.cwd(), "data/telegram/kilo-patches");
const PATCH_INDEX = path.join(PATCH_DIR, "index.jsonl");
const MAX_FILES = 5;
const MAX_DIFF_SIZE = 50000;

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(PATCH_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
}

export interface KiloPatchPlan {
  plan_id: string;
  user_id: string;
  account_label: string;
  task: string;
  files: string[];
  diffs: Record<string, string>;
  status: "pending" | "approved" | "applied" | "failed" | "rolled_back";
  created_at: number;
  applied_at?: number;
  error?: string;
}

export interface KiloApplyRecord {
  apply_id: string;
  plan_id: string;
  user_id: string;
  account_label: string;
  status: "started" | "completed" | "failed" | "rolled_back";
  verify_result?: {
    build_ok: boolean;
    git_diff_clean: boolean;
    error?: string;
  };
  error?: string;
  created_at: number;
  completed_at?: number;
}

const BLOCKED_PATTERNS = [
  /\.env$/i,
  /secrets?/i,
  /keys?/i,
  /credentials?/i,
  /node_modules\//i,
  /\.git\//i,
  /^\.env\./,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /id_ed25519/,
];

const patchPlans = new Map<string, KiloPatchPlan>();
const applyRecords = new Map<string, KiloApplyRecord>();

export function isBlockedPath(filePath: string): boolean {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(filePath)) return true;
  }
  return false;
}

export function validatePatchDiffs(diffs: Record<string, string>): { valid: boolean; error?: string; fileCount?: number } {
  const files = Object.keys(diffs);
  const fileCount = files.length;

  if (fileCount > MAX_FILES) {
    return { valid: false, error: `Max ${MAX_FILES} files allowed, got ${fileCount}` };
  }

  for (const file of files) {
    if (isBlockedPath(file)) {
      return { valid: false, error: `Blocked path: ${file}` };
    }
  }

  let totalDiffSize = 0;
  for (const diff of Object.values(diffs)) {
    totalDiffSize += diff.length;
  }

  if (totalDiffSize > MAX_DIFF_SIZE) {
    return { valid: false, error: `Diff too large: ${totalDiffSize} > ${MAX_DIFF_SIZE}` };
  }

  return { valid: true, fileCount };
}

export async function createPatchPlan(
  userId: string,
  accountLabel: string,
  task: string,
  lang: Language
): Promise<{ plan_id?: string; error?: string }> {
  const planId = makeId("patch");

  console.log("[kilo-write] creating patch plan", { user_id: userId, label: accountLabel, task: task.slice(0, 50) });

  const readResult = await callMCPTool("telegpt_workspace_status", {}, userId, accountLabel);

  const analyzePrompt = `Analyze workspace and create a patch plan for:

${task}

Workspace: ${JSON.stringify(readResult.result || {}).slice(0, 500)}

Create a patch plan in this format:
{
  "files": ["file1.ts", "file2.ts"],
  "diffs": {
    "file1.ts": "--- original\n+++ modified\n@@ ... @@",
    ...
  }
}`;

  const planResult = await callMCPTool("telegpt_patch_plan", { task }, userId, accountLabel);

  let files: string[] = [];
  let diffs: Record<string, string> = {};

  try {
    const parsed = typeof planResult.result === "string" ? JSON.parse(planResult.result) : planResult.result;
    files = parsed?.files || [];
    diffs = parsed?.diffs || {};
  } catch {
    files = [];
    diffs = {};
  }

  const validation = validatePatchDiffs(diffs);
  if (!validation.valid) {
    await logKiloExecution(userId, accountLabel, "telegpt_patch_plan", { task }, "failed", undefined, validation.error);
    return { error: validation.error };
  }

  const plan: KiloPatchPlan = {
    plan_id: planId,
    user_id: userId,
    account_label: accountLabel,
    task,
    files,
    diffs,
    status: "pending",
    created_at: Date.now(),
  };

  patchPlans.set(planId, plan);

  await logKiloExecution(userId, accountLabel, "telegpt_patch_plan", { plan_id: planId }, "completed", undefined, undefined, { files: files.length });

  return { plan_id: planId };
}

export async function previewPatch(
  planId: string,
  userId: string,
  lang: Language
): Promise<string> {
  const plan = patchPlans.get(planId);

  if (!plan) {
    return lang === "ru" ? "Patch план не найден" : "Patch plan not found";
  }

  const lines = [
    `📋 Patch #${planId.slice(-8)}`,
    `Task: ${plan.task.slice(0, 100)}`,
    `Files: ${plan.files.join(", ")}`,
    `Status: ${plan.status}`,
    "",
  ];

  for (const [file, diff] of Object.entries(plan.diffs)) {
    lines.push(`\n${file}:`);
    lines.push("```diff");
    lines.push(diff.slice(0, 1000));
    lines.push("```");
  }

  return lines.join("\n");
}

export async function applyPatch(
  planId: string,
  userId: string,
  accountLabel: string,
  lang: Language
): Promise<{ ok: boolean; apply_id?: string; error?: string }> {
  const plan = patchPlans.get(planId);

  if (!plan) {
    return { ok: false, error: lang === "ru" ? "Patch план не найден" : "Patch plan not found" };
  }

  if (plan.status !== "pending") {
    return { ok: false, error: lang === "ru" ? "Patch уже применён" : "Patch already applied" };
  }

  const canApply = accountLabel === "★" || accountLabel === "★★";
  if (!canApply) {
    await logKiloExecution(userId, accountLabel, "telegpt_patch_apply", { plan_id: planId }, "rejected");
    return { ok: false, error: lang === "ru" ? "Только ★ и ★★ могут применять patch" : "Only ★ and ★★ can apply patches" };
  }

  const applyId = makeId("apply");

  console.log("[kilo-write] applying patch", { apply_id: applyId, plan_id: planId, label: accountLabel });

  await logKiloExecution(userId, accountLabel, "telegpt_patch_apply", { plan_id: planId, apply_id: applyId }, "started");

  plan.status = "applied";
  plan.applied_at = Date.now();

  const record: KiloApplyRecord = {
    apply_id: applyId,
    plan_id: planId,
    user_id: userId,
    account_label: accountLabel,
    status: "started",
    created_at: Date.now(),
  };

  applyRecords.set(applyId, record);

  try {
    const applyResult = await callMCPTool("telegpt_patch_apply", { plan: plan.diffs }, userId, accountLabel);

    if (!applyResult.success) {
      plan.status = "failed";
      record.status = "failed";
      record.error = applyResult.error;

      await logKiloExecution(userId, accountLabel, "telegpt_patch_apply", { apply_id: applyId }, "failed", undefined, applyResult.error);
      return { ok: false, error: applyResult.error || "Apply failed" };
    }

    await logKiloExecution(userId, accountLabel, "telegpt_patch_apply", { apply_id: applyId }, "completed", undefined, undefined, applyResult.result);

    return { ok: true, apply_id: applyId };
  } catch (e: any) {
    plan.status = "failed";
    record.status = "failed";
    record.error = e?.message;

    await logKiloExecution(userId, accountLabel, "telegpt_patch_apply", { apply_id: applyId }, "failed", undefined, e?.message);
    return { ok: false, error: e?.message };
  }
}

export async function verifyApply(
  applyId: string,
  userId: string,
  accountLabel: string,
  lang: Language
): Promise<string> {
  const record = applyRecords.get(applyId);

  if (!record) {
    return lang === "ru" ? "Apply не найден" : "Apply not found";
  }

  console.log("[kilo-write] verifying apply", { apply_id: applyId });

  const buildResult = await callMCPTool("telegpt_execute", { command: "pnpm build" }, userId, accountLabel);
  const gitStatusResult = await callMCPTool("git_status", {}, userId, accountLabel);

  const buildOk = buildResult.success;
  const gitClean = !gitStatusResult.result?.includes("modified");

  record.verify_result = {
    build_ok: buildOk,
    git_diff_clean: gitClean,
  };

  if (buildResult.result) {
    record.verify_result.error = buildResult.result.slice(0, 200);
  }

  record.completed_at = Date.now();

  const status = buildOk && gitClean ? "✅" : "⚠️";

  return `${status} Apply #${applyId.slice(-8)}
${lang === "ru" ? "Сборка" : "Build"}: ${buildOk ? "OK" : "FAILED"}
${lang === "ru" ? "Git" : "Git"}: ${gitClean ? "clean" : "dirty"}
${record.verify_result.error ? `\n\`\`\`\n${record.verify_result.error}\n\`\`\`` : ""}`;
}

export async function rollbackApply(
  applyId: string,
  userId: string,
  accountLabel: string,
  lang: Language
): Promise<{ ok: boolean; error?: string }> {
  if (accountLabel !== "★" && accountLabel !== "★★") {
    return { ok: false, error: lang === "ru" ? "Только ★ и ★★ могут откатывать" : "Only ★ and ★★ can rollback" };
  }

  const record = applyRecords.get(applyId);

  if (!record) {
    return { ok: false, error: lang === "ru" ? "Apply не найден" : "Apply not found" };
  }

  if (record.status !== "completed") {
    return { ok: false, error: lang === "ru" ? "Невозможно откачать незавершённый apply" : "Cannot rollback incomplete apply" };
  }

  console.log("[kilo-write] rolling back", { apply_id: applyId });

  const rollbackResult = await callMCPTool("telegpt_patch_rollback", { apply_id: applyId }, userId, accountLabel);

  if (!rollbackResult.success) {
    return { ok: false, error: rollbackResult.error };
  }

  record.status = "rolled_back";

  const plan = patchPlans.get(record.plan_id);
  if (plan) {
    plan.status = "rolled_back";
  }

  await logKiloExecution(userId, accountLabel, "telegpt_patch_rollback", { apply_id: applyId }, "completed");

  return { ok: true };
}

export function formatPatchList(lang: Language = "ru"): string {
  const plans = Array.from(patchPlans.values()).sort((a, b) => b.created_at - a.created_at);

  if (plans.length === 0) {
    return lang === "ru" ? "Нет patch планов" : "No patch plans";
  }

  const lines = [lang === "ru" ? "📋 Patch планы:" : "📋 Patch plans:"];

  for (const plan of plans.slice(0, 10)) {
    const date = new Date(plan.created_at).toLocaleString();
    const status = plan.status === "pending" ? "⏳" : plan.status === "applied" ? "✅" : plan.status === "failed" ? "❌" : "↩️";
    lines.push(`${status} #${plan.plan_id.slice(-8)} | ${plan.files.length} files | ${date}`);
  }

  return lines.join("\n");
}