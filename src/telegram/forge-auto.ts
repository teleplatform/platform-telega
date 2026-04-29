import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { logKiloExecution } from "./kilo-live.js";
import fs from "fs/promises";
import path from "path";

const FORGE_DIR = path.join(process.cwd(), "data/forge");
const AUTO_MODES_FILE = path.join(FORGE_DIR, "auto-modes.jsonl");
const AUTO_LOGS_FILE = path.join(FORGE_DIR, "auto-evidence.jsonl");

const MAX_AUTO_PER_USER = 1;
const MAX_LOOP_DEPTH = 3;
const COOLDOWN_MS = 30000;
const SAFETY_STAGES = ["review", "apply"];

export type ForgeMode = "manual" | "assisted" | "autonomous";

export interface AutoModeRecord {
  record_id: string;
  workflow_id: string;
  user_id: string;
  account_label: string;
  mode: ForgeMode;
  status: "active" | "paused" | "completed" | "stopped" | "failed";
  current_stage: string;
  loop_count: number;
  max_loops: number;
  auto_approve: boolean;
  wait_approval: boolean;
  created_at: number;
  updated_at: number;
}

const AUTO_STAGES: Record<string, { auto: boolean; requires_approval: boolean }> = {
  intent: { auto: true, requires_approval: false },
  analysis: { auto: true, requires_approval: false },
  plan: { auto: true, requires_approval: false },
  review: { auto: true, requires_approval: true },
  apply: { auto: false, requires_approval: true },
  verify: { auto: true, requires_approval: false },
  complete: { auto: true, requires_approval: false },
};

const STAGES = ["intent", "analysis", "plan", "review", "apply", "verify", "complete"] as const;

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(FORGE_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getNextStage(current: string): string | null {
  const idx = STAGES.indexOf(current as typeof STAGES[number]);
  if (idx < 0 || idx >= STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

async function logEvent(record: AutoModeRecord, event: string, detail: string) {
  try {
    await fs.appendFile(
      AUTO_LOGS_FILE,
      JSON.stringify({
        record_id: record.record_id,
        workflow_id: record.workflow_id,
        event,
        detail,
        loop: record.loop_count,
        stage: record.current_stage,
        timestamp: Date.now(),
      }) + "\n"
    );
  } catch {}
}

export async function setAutoMode(
  workflowId: string,
  mode: ForgeMode,
  userId: string,
  accountLabel: string,
  autoApprove: boolean = false,
  lang: Language = "en"
): Promise<{ ok: boolean; error?: string }> {
  await ensureDir();

  const existingRecords = await readAutoModes();
  const userActive = existingRecords.filter(
    (r) => r.user_id === userId && r.status === "active"
  );

  if (userActive.length >= MAX_AUTO_PER_USER) {
    return {
      ok: false,
      error: lang === "ru"
        ? `Максимум ${MAX_AUTO_PER_USER} авто-режим на пользователя`
        : `Max ${MAX_AUTO_PER_USER} auto mode per user`,
    };
  }

  const record: AutoModeRecord = {
    record_id: makeId("auto"),
    workflow_id: workflowId,
    user_id: userId,
    account_label: accountLabel,
    mode,
    status: "active",
    current_stage: "intent",
    loop_count: 0,
    max_loops: mode === "autonomous" ? MAX_LOOP_DEPTH : mode === "assisted" ? 5 : 1,
    auto_approve: autoApprove && mode === "autonomous",
    wait_approval: false,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await fs.appendFile(AUTO_MODES_FILE, JSON.stringify(record) + "\n");
  await logKiloExecution(userId, accountLabel, "forge_auto_started", { workflow_id: workflowId, mode }, "completed");
  await logEvent(record, "forge_auto_started", `Mode set to ${mode}`);

  if (mode === "autonomous") {
    setTimeout(() => runAutoLoop(record.record_id), 2000);
  }

  return { ok: true };
}

export async function stopAutoMode(
  workflowId: string,
  userId: string,
  accountLabel: string
): Promise<{ ok: boolean; error?: string }> {
  await ensureDir();

  const records = await readAutoModes();
  const record = records.find((r) => r.workflow_id === workflowId && r.status === "active");

  if (!record) {
    return { ok: false, error: "No active auto mode" };
  }

  record.status = "stopped";
  record.updated_at = Date.now();
  await writeAutoModes(records);
  await logKiloExecution(userId, accountLabel, "forge_auto_stopped", { workflow_id: workflowId }, "completed");
  await logEvent(record, "forge_auto_stopped", "Auto mode stopped by user");

  return { ok: true };
}

export async function getAutoMode(workflowId: string): Promise<AutoModeRecord | null> {
  const records = await readAutoModes();
  return records.find((r) => r.workflow_id === workflowId && r.status === "active") ?? null;
}

export async function getAllAutoModes(): Promise<AutoModeRecord[]> {
  return readAutoModes();
}

async function readAutoModes(): Promise<AutoModeRecord[]> {
  try {
    await ensureDir();
    const content = await fs.readFile(AUTO_MODES_FILE, "utf-8");
    return content.trim().split("\n").filter(Boolean).map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    }).filter(Boolean) as AutoModeRecord[];
  } catch {
    return [];
  }
}

async function writeAutoModes(records: AutoModeRecord[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(AUTO_MODES_FILE, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

async function runAutoLoop(recordId: string): Promise<void> {
  try {
    const now = Date.now();
    const records = await readAutoModes();
    const idx = records.findIndex((r) => r.record_id === recordId);
    if (idx < 0) return;

    const record = records[idx];

    if (record.status !== "active") return;

    if (record.loop_count >= record.max_loops) {
      record.status = "completed";
      record.updated_at = now;
      await writeAutoModes(records);
      await logEvent(record, "forge_auto_completed", "Max loops reached");
      return;
    }

    if (record.loop_count > 0) {
      const timeSinceLastUpdate = now - (record.updated_at ?? record.created_at);
      if (timeSinceLastUpdate < COOLDOWN_MS) {
        await logEvent(record, "forge_auto_cooldown", `Waiting ${COOLDOWN_MS}ms before next step`);
        setTimeout(() => runAutoLoop(recordId), COOLDOWN_MS);
        return;
      }
    }

    const settings = AUTO_STAGES[record.current_stage];
    if (!settings) {
      record.status = "completed";
      record.updated_at = now;
      await writeAutoModes(records);
      return;
    }

    if (SAFETY_STAGES.includes(record.current_stage) && record.mode === "autonomous") {
      if (!record.auto_approve) {
        if (!record.wait_approval) {
          record.wait_approval = true;
          record.updated_at = now;
          await writeAutoModes(records);
          await logEvent(record, "forge_auto_safety_stop", `Safety stop at ${record.current_stage}`);
          return;
        }
      }
    }

    if (settings.requires_approval && !record.auto_approve && record.mode === "autonomous") {
      if (!record.wait_approval) {
        record.wait_approval = true;
        record.updated_at = now;
        await writeAutoModes(records);
        await logEvent(record, "forge_auto_waiting_approval", `Stage: ${record.current_stage}`);
      }
      setTimeout(() => runAutoLoop(recordId), 5000);
      return;
    }

    if (record.wait_approval) {
      record.wait_approval = false;
    }

    const oldStage = record.current_stage;
    const nextStage = getNextStage(oldStage);

    if (!nextStage) {
      record.status = "completed";
      record.updated_at = now;
      await writeAutoModes(records);
      await logEvent(record, "forge_auto_completed", "Workflow completed");
      return;
    }

    record.current_stage = nextStage;
    record.loop_count++;
    record.updated_at = now;

    await writeAutoModes(records);
    await logEvent(record, "forge_auto_step", `${oldStage} → ${nextStage}`);

    if (nextStage === "complete") {
      record.status = "completed";
      record.updated_at = Date.now();
      await writeAutoModes(records);
      await logKiloExecution(record.user_id, record.account_label, "forge_auto_completed", { workflow_id: record.workflow_id }, "completed");
      await logEvent(record, "forge_auto_completed", "Workflow completed in auto mode");
      return;
    }

    const delay = nextStage === "apply" ? 5000 : 3000;
    setTimeout(() => runAutoLoop(recordId), delay);
  } catch (e: any) {
    console.error("[forge-auto] loop error", e?.message);
  }
}