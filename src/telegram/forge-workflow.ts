import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { getAccountLabel } from "./bot.js";
import { createPatchPlan, applyPatch, verifyApply, rollbackApply } from "./kilo-controlled-write.js";
import { callMCPTool } from "./mcp-bridge.js";
import fs from "fs/promises";
import path from "path";

const WORKFLOWS_DIR = path.join(process.cwd(), "data/forge");
const WORKFLOWS_FILE = path.join(WORKFLOWS_DIR, "workflows.jsonl");
const GATES_FILE = path.join(WORKFLOWS_DIR, "gate-reports.jsonl");

export type WorkflowStage = "intent" | "analysis" | "plan" | "review" | "apply" | "verify" | "complete";

export const STAGES: WorkflowStage[] = [
  "intent",
  "analysis",
  "plan",
  "review",
  "apply",
  "verify",
  "complete"
];

export const STAGE_DESCRIPTIONS: Record<WorkflowStage, { ru: string; en: string }> = {
  intent: { ru: "Определение намерения", en: "Intent definition" },
  analysis: { ru: "Анализ проекта", en: "Project analysis" },
  plan: { ru: "Создание плана", en: "Creating plan" },
  review: { ru: "Ожидание review", en: "Awaiting review" },
  apply: { ru: "Применение изменений", en: "Applying changes" },
  verify: { ru: "Верификация", en: "Verification" },
  complete: { ru: "Завершено", en: "Completed" },
};

export interface GateResult {
  gate: string;
  passed: boolean;
  checks: Record<string, { passed: boolean; message: string }>;
  error?: string;
  timestamp: number;
}

export interface WorkflowStageRecord {
  stage: WorkflowStage;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  started_at?: number;
  completed_at?: number;
  result?: string;
  error?: string;
  gate_results?: Record<WorkflowStage, GateResult>;
}

export interface ForgeWorkflow {
  workflow_id: string;
  user_id: string;
  account_label: string;
  title: string;
  task: string;
  current_stage: WorkflowStage;
  stages: Record<WorkflowStage, WorkflowStageRecord>;
  patch_plan_id?: string;
  apply_id?: string;
  can_continue: boolean;
  stop_at?: WorkflowStage;
  error?: string;
  created_at: number;
  updated_at: number;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(WORKFLOWS_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function initStages(stopAt?: WorkflowStage): Record<WorkflowStage, WorkflowStageRecord> {
  const result: Record<WorkflowStage, WorkflowStageRecord> = {} as any;
  for (const stage of STAGES) {
    if (stopAt && stage === stopAt) {
      result[stage] = { stage, status: "pending" };
      break;
    }
    result[stage] = { stage, status: "pending" };
  }
  return result;
}

function getNextStage(current: WorkflowStage): WorkflowStage | null {
  const idx = STAGES.indexOf(current);
  if (idx < 0 || idx >= STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

function getStageDescription(stage: WorkflowStage, lang: Language): string {
  return lang === "ru" ? STAGE_DESCRIPTIONS[stage].ru : STAGE_DESCRIPTIONS[stage].en;
}

export async function createWorkflow(
  userId: string,
  accountLabel: string,
  title: string,
  task: string,
  lang: Language,
  options?: { stopAt?: WorkflowStage }
): Promise<{ workflow_id?: string; error?: string }> {
  await ensureDir();

  const workflowId = makeId("wf");

  console.log("[forge-workflow] creating workflow", { user_id: userId, label: accountLabel, task: task.slice(0, 50) });

  const stages = initStages(options?.stopAt);

  const workflow: ForgeWorkflow = {
    workflow_id: workflowId,
    user_id: userId,
    account_label: accountLabel,
    title,
    task,
    current_stage: "intent",
    stages,
    can_continue: true,
    stop_at: options?.stopAt,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const line = JSON.stringify(workflow) + "\n";
  await fs.appendFile(WORKFLOWS_FILE, line, "utf-8");

  console.log("[forge-workflow] workflow created", { workflow_id: workflowId });

  return { workflow_id: workflowId };
}

export async function getWorkflow(workflowId: string): Promise<ForgeWorkflow | null> {
  try {
    await ensureDir();
    const content = await fs.readFile(WORKFLOWS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const workflow = JSON.parse(line) as ForgeWorkflow;
        if (workflow.workflow_id === workflowId) {
          return workflow;
        }
      } catch {}
    }
  } catch {}
  return null;
}

export async function updateWorkflow(workflowId: string, updates: Partial<ForgeWorkflow>): Promise<boolean> {
  try {
    await ensureDir();
    const content = await fs.readFile(WORKFLOWS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const workflows: ForgeWorkflow[] = [];

    for (const line of lines) {
      try {
        const wf = JSON.parse(line) as ForgeWorkflow;
        if (wf.workflow_id === workflowId) {
          Object.assign(wf, updates, { updated_at: Date.now() });
        }
        workflows.push(wf);
      } catch {}
    }

    const newContent = workflows.map(w => JSON.stringify(w)).join("\n") + "\n";
    await fs.writeFile(WORKFLOWS_FILE, newContent, "utf-8");
    return true;
  } catch (e) {
    console.error("[forge-workflow] update failed", e);
    return false;
  }
}

export async function executeStage(
  workflowId: string,
  userId: string,
  accountLabel: string,
  lang: Language
): Promise<{ ok: boolean; stage?: WorkflowStage; error?: string }> {
  const workflow = await getWorkflow(workflowId);
  if (!workflow) {
    return { ok: false, error: "Workflow not found" };
  }

  const current = workflow.current_stage;
  const stageRecord = workflow.stages[current];

  if (!stageRecord) {
    return { ok: false, error: `Stage ${current} not found` };
  }

  console.log("[forge-workflow] executing stage", { workflow_id: workflowId, stage: current });

  stageRecord.status = "running";
  stageRecord.started_at = Date.now();
  await updateWorkflow(workflowId, { stages: workflow.stages });

  try {
    switch (current) {
      case "intent": {
        stageRecord.result = `Intent captured: ${workflow.task.slice(0, 100)}`;
        stageRecord.status = "completed";
        stageRecord.completed_at = Date.now();
        workflow.current_stage = "analysis";
        break;
      }

      case "analysis": {
        const wsResult = await callMCPTool("telegpt_workspace_status", {}, userId, accountLabel);
        stageRecord.result = JSON.stringify(wsResult.result || {}).slice(0, 500);
        stageRecord.status = "completed";
        stageRecord.completed_at = Date.now();
        workflow.current_stage = "plan";
        break;
      }

      case "plan": {
        const planResult = await createPatchPlan(userId, accountLabel, workflow.task, lang);
        if (planResult.error) {
          throw new Error(planResult.error);
        }
        workflow.patch_plan_id = planResult.plan_id;
        stageRecord.result = `Plan created: ${planResult.plan_id}`;
        stageRecord.status = "completed";
        stageRecord.completed_at = Date.now();
        workflow.current_stage = "review";
        break;
      }

      case "review": {
        const canApply = accountLabel === "★" || accountLabel === "★★";
        if (!canApply) {
          stageRecord.result = lang === "ru"
            ? "Ожидает одобрения владельца"
            : "Awaiting owner approval";
          workflow.can_continue = false;
          return { ok: true, stage: current };
        }
        workflow.current_stage = "apply";
        break;
      }

      case "apply": {
        if (!workflow.patch_plan_id) {
          throw new Error("No patch plan to apply");
        }
        const applyResult = await applyPatch(workflow.patch_plan_id, userId, accountLabel, lang);
        if (!applyResult.ok) {
          throw new Error(applyResult.error || "Apply failed");
        }
        workflow.apply_id = applyResult.apply_id;
        stageRecord.result = `Applied: ${applyResult.apply_id}`;
        stageRecord.status = "completed";
        stageRecord.completed_at = Date.now();
        workflow.current_stage = "verify";
        break;
      }

      case "verify": {
        if (workflow.apply_id) {
          const verifyResult = await verifyApply(workflow.apply_id, userId, accountLabel, lang);
          stageRecord.result = verifyResult;
        }
        stageRecord.status = "completed";
        stageRecord.completed_at = Date.now();
        workflow.current_stage = "complete";
        break;
      }

      case "complete": {
        stageRecord.status = "completed";
        stageRecord.completed_at = Date.now();
        workflow.can_continue = false;
        break;
      }
    }

    const nextStage = getNextStage(current);
    if (nextStage && nextStage !== current) {
      if (workflow.stop_at && nextStage === workflow.stop_at) {
        workflow.can_continue = false;
      }
    }

    await updateWorkflow(workflowId, workflow);

    return { ok: true, stage: workflow.current_stage };
  } catch (e: any) {
    stageRecord.status = "failed";
    stageRecord.error = e?.message;
    workflow.error = e?.message;
    await updateWorkflow(workflowId, { stages: workflow.stages, error: e?.message });
    return { ok: false, error: e?.message };
  }
}

export async function validateGate(
  workflowId: string,
  stage: WorkflowStage,
  workflow: ForgeWorkflow,
  lang: Language
): Promise<GateResult> {
  const gate: GateResult = {
    gate: stage,
    passed: false,
    checks: {},
    timestamp: Date.now(),
  };

  const addCheck = (name: string, passed: boolean, message: string) => {
    gate.checks[name] = { passed, message };
  };

  switch (stage) {
    case "intent": {
      const taskExists = !!(workflow.task && workflow.task.trim().length > 0);
      addCheck("task_not_empty", taskExists, lang === "ru" ? "Задача не пуста" : "Task is non-empty");
      const targetFound = workflow.task.toLowerCase().includes("src/") || workflow.task.toLowerCase().includes("file");
      addCheck("target_detected", !!targetFound, lang === "ru" ? "Целевой файл найден" : "Target detected");
      break;
    }

    case "analysis": {
      const hasResult = !!workflow.stages.analysis?.result;
      addCheck("workspace_captured", hasResult, lang === "ru" ? "Статус workspace захвачен" : "Workspace status captured");
      const hasFiles = (workflow.stages.analysis?.result || "").length > 10;
      addCheck("files_found", hasFiles, lang === "ru" ? "Файлы проекта найдены" : "Project files found");
      break;
    }

    case "plan": {
      const planExists = !!workflow.patch_plan_id;
      addCheck("patch_plan_created", planExists, lang === "ru" ? "Patch план создан" : "Patch plan created");
      const filesLimited = workflow.patch_plan_id ? workflow.patch_plan_id.length > 0 : false;
      addCheck("files_limited", filesLimited, lang === "ru" ? "Файлов <= 5" : "Files <= 5");
      break;
    }

    case "review": {
      const isOwner = workflow.account_label === "★" || workflow.account_label === "★★";
      addCheck("owner_approval", isOwner, lang === "ru" ? "Одобрение владельца" : "Owner approval required");
      break;
    }

    case "apply": {
      const patchExists = !!workflow.patch_plan_id;
      addCheck("approved_patch", patchExists, lang === "ru" ? "Approve patch_id" : "Approved patch_id exists");
      const noBlocked = !workflow.stages.apply?.error?.includes(".env");
      addCheck("no_blocked_files", noBlocked, lang === "ru" ? "Нет заблокированных файлов" : "No blocked files");
      break;
    }

    case "verify": {
      const hasResult = !!workflow.stages.verify?.result;
      addCheck("build_executed", hasResult, lang === "ru" ? "Сборка выполнена" : "Build executed");
      const hasNoError = !workflow.stages.verify?.error;
      addCheck("no_build_errors", hasNoError, lang === "ru" ? "Нет ошибок сборки" : "No build errors");
      break;
    }

    case "complete": {
      const isComplete = workflow.stages.complete?.status === "completed";
      addCheck("report_delivered", isComplete, lang === "ru" ? "Отчёт доставлен" : "Final report delivered");
      const hasEvidence = !!(workflow.apply_id || workflow.patch_plan_id);
      addCheck("evidence_linked", hasEvidence, lang === "ru" ? "Связана evidence" : "Evidence/audit linked");
      break;
    }
  }

  gate.passed = Object.values(gate.checks).every(c => c.passed);

  try {
    await fs.appendFile(GATES_FILE, JSON.stringify({ workflow_id: workflowId, ...gate }) + "\n", "utf-8");
  } catch (e) {
    console.error("[forge-gates] save failed", e);
  }

  return gate;
}

export async function checkGates(workflowId: string, lang: Language = "ru"): Promise<string> {
  const workflow = await getWorkflow(workflowId);
  if (!workflow) {
    return lang === "ru" ? "Workflow не найден" : "Workflow not found";
  }

  const lines = [lang === "ru" ? "🚧 Quality Gates" : "🚧 Quality Gates"];

  for (const stage of STAGES) {
    const stageRecord = workflow.stages[stage];
    if (!stageRecord) continue;

    const gateResult = await validateGate(workflowId, stage, workflow, lang);

    const icon = gateResult.passed ? "✅" : "⛔";
    const blocked = stageRecord.status === "pending" && !gateResult.passed && stage === workflow.current_stage;
    const blockIcon = blocked ? "🔒" : " ";

    lines.push(`${blockIcon}${icon} ${stage}: ${getStageDescription(stage, lang)}`);

    for (const [check, result] of Object.entries(gateResult.checks)) {
      const checkIcon = result.passed ? "✓" : "✗";
      lines.push(`   ${checkIcon} ${check}: ${result.message}`);
    }
  }

  return lines.join("\n");
}

export function formatValidationReport(gate: GateResult, lang: Language = "ru"): string {
  const lines = [
    lang === "ru" ? "📋 Quality Gate Report" : "📋 Quality Gate Report",
    `Gate: ${gate.gate}`,
    `Passed: ${gate.passed ? "✅ YES" : "❌ NO"}`,
    "",
  ];

  for (const [check, result] of Object.entries(gate.checks)) {
    const icon = result.passed ? "✅" : "❌";
    lines.push(`${icon} ${check}: ${result.message}`);
  }

  if (gate.error) {
    lines.push(`\n❌ Error: ${gate.error}`);
  }

  return lines.join("\n");
}

export async function skipStage(
  workflowId: string,
  stage: WorkflowStage,
  userId: string,
  accountLabel: string,
  lang: Language
): Promise<{ ok: boolean; error?: string }> {
  const workflow = await getWorkflow(workflowId);
  if (!workflow) {
    return { ok: false, error: "Workflow not found" };
  }

  const stageIdx = STAGES.indexOf(stage);
  if (stageIdx < 0) {
    return { ok: false, error: `Invalid stage: ${stage}` };
  }

  const stageRecord = workflow.stages[stage];
  if (!stageRecord) {
    return { ok: false, error: `Stage ${stage} not found in workflow` };
  }

  stageRecord.status = "skipped";
  stageRecord.completed_at = Date.now();
  stageRecord.result = `Skipped by ${accountLabel}`;

  await updateWorkflow(workflowId, { stages: workflow.stages });

  return { ok: true };
}

export async function restartWorkflow(
  workflowId: string,
  fromStage: WorkflowStage = "intent"
): Promise<{ ok: boolean; error?: string }> {
  const workflow = await getWorkflow(workflowId);
  if (!workflow) {
    return { ok: false, error: "Workflow not found" };
  }

  const newStages = initStages(workflow.stop_at);

  newStages[fromStage] = { stage: fromStage, status: "pending" };
  for (let i = 0; i < STAGES.indexOf(fromStage); i++) {
    newStages[STAGES[i]] = { stage: STAGES[i], status: "skipped", completed_at: Date.now() };
  }

  await updateWorkflow(workflowId, {
    current_stage: fromStage,
    stages: newStages,
    can_continue: true,
    error: undefined,
  });

  return { ok: true };
}

export function formatWorkflowVisualization(workflow: ForgeWorkflow, lang: Language = "ru"): string {
  const lines: string[] = [];

  lines.push(`🔨 Workflow #${workflow.workflow_id.slice(-8)}`);
  lines.push(`📌 ${workflow.title}`);
  lines.push("");

  const stageOrder = STAGES.filter(s => workflow.stages[s]?.status);
  const stageStr = stageOrder.map(s => {
    const rec = workflow.stages[s];
    const isCurrent = s === workflow.current_stage;
    const icon = isCurrent ? "👉" : rec?.status === "completed" ? "✅" : rec?.status === "failed" ? "❌" : rec?.status === "skipped" ? "⏭️" : "⏳";
    return `${icon} ${getStageDescription(s, lang)}`;
  }).join(" → ");

  lines.push(stageStr);
  lines.push("");

  if (workflow.error) {
    lines.push(`❌ Error: ${workflow.error}`);
  }

  return lines.join("\n");
}

export function formatWorkflowList(workflows: ForgeWorkflow[], lang: Language = "ru"): string {
  if (workflows.length === 0) {
    return lang === "ru" ? "Нет workflows" : "No workflows";
  }

  const lines = [lang === "ru" ? "🔨 Workflows:" : "🔨 Workflows:"];

  for (const wf of workflows.slice(0, 10)) {
    const rec = wf.stages[wf.current_stage];
    const icon = rec?.status === "completed" ? "✅" : rec?.status === "failed" ? "❌" : "⏳";
    lines.push(`${icon} #${wf.workflow_id.slice(-8)} | ${wf.title.slice(0, 25)}... | ${wf.current_stage}`);
  }

  return lines.join("\n");
}

export async function listWorkflows(userId: string, limit = 20): Promise<ForgeWorkflow[]> {
  const workflows: ForgeWorkflow[] = [];

  try {
    await ensureDir();
    const content = await fs.readFile(WORKFLOWS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit);

    for (const line of lines) {
      try {
        const wf = JSON.parse(line) as ForgeWorkflow;
        if (wf.user_id === userId) {
          workflows.push(wf);
        }
      } catch {}
    }
  } catch {}

  return workflows.sort((a, b) => b.updated_at - a.updated_at).slice(0, limit);
}