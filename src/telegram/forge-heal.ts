import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { getAccountLabel } from "./bot.js";
import fs from "fs/promises";
import path from "path";

const HEAL_DIR = path.join(process.cwd(), "data/forge");
const HEAL_PLANS_FILE = path.join(HEAL_DIR, "heal-plans.jsonl");

export type FailureType = 
  | "build_failed"
  | "test_failed"
  | "provider_timeout"
  | "kilo_tool_failed"
  | "patch_apply_failed"
  | "verification_failed"
  | "stalled_workflow"
  | "dependency_blocked"
  | "gate_failed"
  | "unknown";

export type HealRiskLevel = "low" | "medium" | "high" | "critical";

export interface HealPlan {
  heal_id: string;
  workflow_id: string;
  failure_type: FailureType;
  diagnosis: string;
  proposed_steps: string[];
  risk_level: HealRiskLevel;
  requires_owner_approval: boolean;
  status: "pending" | "approved" | "applied" | "failed";
  created_by: string;
  approved_by?: string;
  applied_at?: number;
  error?: string;
  timestamp: number;
}

export const FAILURE_PATTERNS: Record<FailureType, { keywords: string[]; diagnosis: string; risk: HealRiskLevel }> = {
  build_failed: {
    keywords: ["build", "compile", "tsc", "error"],
    diagnosis: "Сборка проекта не прошла. Возможна ошибка в коде или зависимостях.",
    risk: "high",
  },
  test_failed: {
    keywords: ["test", "assert", "fail"],
    diagnosis: "Тесты не прошли. Изменения нарушили существующую функциональность.",
    risk: "critical",
  },
  provider_timeout: {
    keywords: ["timeout", "abort", "timed out"],
    diagnosis: "Провайдер (MCP/Kilo) не ответил вовремя. Возможно перегруз.",
    risk: "medium",
  },
  kilo_tool_failed: {
    keywords: ["kilo", "tool", "execute", "failed"],
    diagnosis: "Инструмент Kilo не выполнился. Проверьте доступность и права.",
    risk: "medium",
  },
  patch_apply_failed: {
    keywords: ["patch", "apply", "failed"],
    diagnosis: "Patch не применился. Конфликт или некорректный diff.",
    risk: "high",
  },
  verification_failed: {
    keywords: ["verify", "check", "failed"],
    diagnosis: "Верификация после применения не прошла. Изменения некорректны.",
    risk: "critical",
  },
  stalled_workflow: {
    keywords: ["stalled", "heartbeat", "no response"],
    diagnosis: "Workflow остановился без ответа. Требуется перезапуск или откат.",
    risk: "medium",
  },
  dependency_blocked: {
    keywords: ["dependency", "blocked", "waiting"],
    diagnosis: "Workflow заблокирован из-за незавершённой зависимости.",
    risk: "low",
  },
  gate_failed: {
    keywords: ["gate", "check", "failed"],
    diagnosis: "Quality gate не пройден. Проверьте входные данные.",
    risk: "high",
  },
  unknown: {
    keywords: [],
    diagnosis: "Неизвестная ошибка. Требуется ручной анализ.",
    risk: "critical",
  },
};

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(HEAL_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function classifyFailure(errorMessage: string): FailureType {
  const lowerError = (errorMessage || "").toLowerCase();

  for (const [type, config] of Object.entries(FAILURE_PATTERNS)) {
    if (type === "unknown") continue;

    for (const keyword of config.keywords) {
      if (lowerError.includes(keyword)) {
        return type as FailureType;
      }
    }
  }

  return "unknown";
}

export function proposeHealSteps(
  failureType: FailureType,
  workflow: any,
  lang: Language
): string[] {
  const steps: string[] = [];

  const pattern = FAILURE_PATTERNS[failureType];
  if (!pattern) {
    return [lang === "ru" ? "Требуется ручной анализ" : "Requires manual analysis"];
  }

  switch (failureType) {
    case "build_failed": {
      steps.push(lang === "ru" ? "1. Проверить сообщение об ошибке" : "1. Check error message");
      steps.push(lang === "ru" ? "2. Исправить ошибку компиляции" : "2. Fix compilation error");
      steps.push(lang === "ru" ? "3. Повторить verify" : "3. Re-run verify");
      break;
    }
    case "test_failed": {
      steps.push(lang === "ru" ? "1. Запустить тесты локально" : "1. Run tests locally");
      steps.push(lang === "ru" ? "2. Исправить падающие тесты" : "2. Fix failing tests");
      steps.push(lang === "ru" ? "3. Commit с исправлениями" : "3. Commit fixes");
      break;
    }
    case "provider_timeout": {
      steps.push(lang === "ru" ? "1. Подождать 5 минут" : "1. Wait 5 minutes");
      steps.push(lang === "ru" ? "2. Повторить запрос" : "2. Retry request");
      steps.push(lang === "ru" ? "3. Использовать другой провайдер" : "3. Use different provider");
      break;
    }
    case "patch_apply_failed": {
      steps.push(lang === "ru" ? "1. Проверить diff" : "1. Check diff");
      steps.push(lang === "ru" ? "2. Разрешить конфликты" : "2. Resolve conflicts");
      steps.push(lang === "ru" ? "3. Пересоздать patch" : "3. Recreate patch");
      break;
    }
    case "verification_failed": {
      steps.push(lang === "ru" ? "1. Проверить результат verify" : "1. Check verify result");
      steps.push(lang === "ru" ? "2. Откатить изменения" : "2. Rollback changes");
      steps.push(lang === "ru" ? "3. Пересоздать patch с исправлениями" : "3. Recreate patch with fixes");
      break;
    }
    case "stalled_workflow": {
      steps.push(lang === "ru" ? "1. Вызвать /forge_recover" : "1. Call /forge_recover");
      steps.push(lang === "ru" ? "2. Проверить checkpoint" : "2. Check checkpoint");
      steps.push(lang === "ru" ? "3. Возобновить с последнего этапа" : "3. Resume from last stage");
      break;
    }
    case "gate_failed": {
      steps.push(lang === "ru" ? "1. Проверить gate результаты" : "1. Check gate results");
      steps.push(lang === "ru" ? "2. Исправить входные данные" : "2. Fix input data");
      steps.push(lang === "ru" ? "3. Перезапустить workflow" : "3. Restart workflow");
      break;
    }
    default: {
      steps.push(lang === "ru" ? "1. Ручной анализ" : "1. Manual analysis");
      steps.push(lang === "ru" ? "2. Определить причину" : "2. Determine cause");
      steps.push(lang === "ru" ? "3. Применить исправление" : "3. Apply fix");
    }
  }

  return steps;
}

export async function createHealPlan(
  workflowId: string,
  failureType: FailureType,
  errorMessage: string,
  createdBy: string,
  lang: Language
): Promise<HealPlan> {
  await ensureDir();

  const pattern = FAILURE_PATTERNS[failureType];
  const diagnosis = pattern?.diagnosis || FAILURE_PATTERNS.unknown.diagnosis;
  const riskLevel = pattern?.risk as HealRiskLevel || "critical";

  const steps = proposeHealSteps(failureType, null, lang);

  const plan: HealPlan = {
    heal_id: makeId("heal"),
    workflow_id: workflowId,
    failure_type: failureType,
    diagnosis,
    proposed_steps: steps,
    risk_level: riskLevel,
    requires_owner_approval: riskLevel === "critical" || riskLevel === "high",
    status: "pending",
    created_by: createdBy,
    timestamp: Date.now(),
  };

  const line = JSON.stringify(plan) + "\n";
  await fs.appendFile(HEAL_PLANS_FILE, line, "utf-8");

  console.log("[forge-heal] plan created", { workflow_id: workflowId, failure_type: failureType, risk: riskLevel });

  return plan;
}

export async function getHealPlan(healId: string): Promise<HealPlan | null> {
  const plans: HealPlan[] = [];

  try {
    await ensureDir();
    const content = await fs.readFile(HEAL_PLANS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const plan = JSON.parse(line) as HealPlan;
        if (plan.heal_id === healId) {
          return plan;
        }
      } catch {}
    }
  } catch {}

  return null;
}

export async function getWorkflowHealPlans(workflowId: string): Promise<HealPlan[]> {
  const plans: HealPlan[] = [];

  try {
    await ensureDir();
    const content = await fs.readFile(HEAL_PLANS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const plan = JSON.parse(line) as HealPlan;
        if (plan.workflow_id === workflowId) {
          plans.push(plan);
        }
      } catch {}
    }
  } catch {}

  return plans.sort((a, b) => b.timestamp - a.timestamp);
}

export async function updateHealPlanStatus(
  healId: string,
  status: HealPlan["status"],
  approvedBy?: string
): Promise<boolean> {
  const Plan = await getHealPlan(healId);
  if (!Plan) return false;

  const allPlans: HealPlan[] = [];

  try {
    const content = await fs.readFile(HEAL_PLANS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const plan = JSON.parse(line) as HealPlan;
        if (plan.heal_id === healId) {
          plan.status = status;
          if (approvedBy) plan.approved_by = approvedBy;
          if (status === "applied") plan.applied_at = Date.now();
        }
        allPlans.push(plan);
      } catch {}
    }

    const newContent = allPlans.map(p => JSON.stringify(p)).join("\n") + "\n";
    await fs.writeFile(HEAL_PLANS_FILE, newContent, "utf-8");

    return true;
  } catch (e) {
    console.error("[forge-heal] update failed", e);
    return false;
  }
}

export function formatHealPlan(plan: HealPlan, lang: Language = "ru"): string {
  const lines = [
    lang === "ru" ? "💊 Heal Plan" : "💊 Heal Plan",
    `#${plan.heal_id.slice(-8)}`,
    `Workflow: ${plan.workflow_id.slice(-8)}`,
    `Failure: ${plan.failure_type}`,
    `Risk: ${plan.risk_level.toUpperCase()}`,
    "",
    `📋 ${lang === "ru" ? "Диагноз" : "Diagnosis"}:`,
    plan.diagnosis,
    "",
    lang === "ru" ? "📝 Steps:" : "📝 Steps:",
  ];

  for (let i = 0; i < plan.proposed_steps.length; i++) {
    lines.push(`${i + 1}. ${plan.proposed_steps[i]}`);
  }

  lines.push("");
  lines.push(`Status: ${plan.status}`);
  if (plan.approved_by) {
    lines.push(`Approved: ${plan.approved_by}`);
  }

  return lines.join("\n");
}

export function formatDiagnosis(
  workflowId: string,
  failureType: FailureType,
  errorMessage: string,
  lang: Language = "ru"
): string {
  const lines = [
    lang === "ru" ? "🔍 Diagnosis" : "🔍 Diagnosis",
    `Workflow: ${workflowId.slice(-8)}`,
    `Type: ${failureType}`,
    "",
  ];

  const pattern = FAILURE_PATTERNS[failureType];
  if (pattern) {
    lines.push(pattern.diagnosis);
    lines.push(`\nRisk: ${pattern.risk.toUpperCase()}`);
  }

  if (errorMessage) {
    lines.push(`\nError: ${errorMessage.slice(0, 200)}`);
  }

  return lines.join("\n");
}