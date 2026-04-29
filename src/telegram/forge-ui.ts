import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { getAccountLabel, isArisha } from "./bot.js";
import { Markup } from "telegraf";
import { ForgeWorkflow, STAGES, WorkflowStage } from "./forge-workflow.js";
import { ForgeTask } from "./forge-shell.js";
import { TaskGraphNode } from "./forge-graph.js";
import { Checkpoint } from "./forge-checkpoints.js";

export type UIControls = "next" | "review" | "apply" | "pause" | "resume" | "skip" | "restart" | "delete" | "gates" | "report" | "timeline";

const CONTROL_ICONS: Record<UIControls, { ru: string; en: string }> = {
  next: { ru: "▶️ Далее", en: "▶️ Next" },
  review: { ru: "🔍 Review", en: "🔍 Review" },
  apply: { ru: "🛠 Apply", en: "🛠 Apply" },
  pause: { ru: "⏸ Пауза", en: "⏸ Pause" },
  resume: { ru: "▶️ Resume", en: "▶️ Resume" },
  skip: { ru: "⏭ Пропустить", en: "⏭ Skip" },
  restart: { ru: "🔄 Restart", en: "🔄 Restart" },
  delete: { ru: "🗑 Удалить", en: "🗑 Delete" },
  gates: { ru: "🚧 Gates", en: "🚧 Gates" },
  report: { ru: "📋 Report", en: "📋 Report" },
  timeline: { ru: "📜 Timeline", en: "📜 Timeline" },
};

export interface UIControlButton {
  control: UIControls;
  callback: string;
  style?: "default" | "primary" | "danger";
}

export function buildWorkflowKeyboard(
  workflow: ForgeWorkflow,
  canContinue: boolean,
  lang: Language = "ru"
): ReturnType<typeof Markup.inlineKeyboard> {
  const buttons: UIControlButton[] = [];

  const currentStage = workflow.current_stage;
  const isComplete = currentStage === "complete";
  const isFailed = workflow.error && currentStage !== "complete";

  if (!isComplete && !isFailed) {
    if (canContinue) {
      buttons.push({ control: "next", callback: `forge:next:${workflow.workflow_id}` });
    }
  }

  if (currentStage === "review" || currentStage === "apply") {
    buttons.push({ control: "review", callback: `forge:review:${workflow.workflow_id}` });
  }

  buttons.push({ control: "gates", callback: `forge:gates:${workflow.workflow_id}` });
  buttons.push({ control: "timeline", callback: `forge:timeline:${workflow.workflow_id}` });

  if (isFailed) {
    buttons.push({ control: "restart", callback: `forge:restart:${workflow.workflow_id}` });
  }

  const rows: { text: string; callback_data: string }[][] = [];
  let row: { text: string; callback_data: string }[] = [];

  for (const btn of buttons) {
    const icon = CONTROL_ICONS[btn.control];
    row.push({
      text: lang === "ru" ? icon.ru : icon.en,
      callback_data: btn.callback,
    });

    if (row.length >= 2) {
      rows.push(row);
      row = [];
    }
  }

  if (row.length > 0) {
    rows.push(row);
  }

  rows.push([{ text: "🔄 Refresh", callback_data: `forge:refresh:${workflow.workflow_id}` }]);

  return Markup.inlineKeyboard(rows);
}

export function buildTaskListKeyboard(
  tasks: ForgeTask[],
  lang: Language = "ru"
): ReturnType<typeof Markup.inlineKeyboard> {
  const buttons: { text: string; callback_data: string }[] = [];

  for (const task of tasks.slice(0, 8)) {
    const statusIcon = task.status === "verified" ? "✅" :
                      task.status === "failed" ? "❌" :
                      task.status === "planned" ? "📋" : "⏳";

    const label = `${statusIcon} ${task.title.slice(0, 25)}...`;
    buttons.push({ text: label, callback_data: `forge:task:${task.forge_task_id}` });
  }

  if (buttons.length === 0) {
    return Markup.inlineKeyboard([]);
  }

  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  return Markup.inlineKeyboard(rows);
}

export function buildTimelineKeyboard(
  workflowId: string,
  lang: Language = "ru"
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [{ text: "📋 Report", callback_data: `forge:report:${workflowId}` }],
    [{ text: "🚧 Gates", callback_data: `forge:gates:${workflowId}` }],
    [{ text: "🔄 Refresh", callback_data: `forge:refresh:${workflowId}` }],
  ]);
}

export function formatWorkflowCard(
  workflow: ForgeWorkflow,
  lang: Language = "ru"
): { text: string; keyboard: ReturnType<typeof Markup.inlineKeyboard> } {
  const statusIcon = {
    intent: "⏳",
    analysis: "⏳",
    plan: "⏳",
    review: "⏳",
    apply: "🔄",
    verify: "🔄",
    complete: "✅",
  }[workflow.current_stage] || "⏳";

  const lines = [
    `🔨 ${workflow.title}`,
    `Stage: ${statusIcon} ${workflow.current_stage}`,
  ];

  if (workflow.error) {
    lines.push(`❌ ${workflow.error.slice(0, 50)}`);
  }

  const text = lines.join("\n");
  const keyboard = buildWorkflowKeyboard(workflow, workflow.can_continue, lang);

  return { text, keyboard };
}

export function formatProgressBar(
  currentStage: WorkflowStage,
  lang: Language = "ru"
): string {
  const icon = (stage: WorkflowStage, current: WorkflowStage) => {
    const idx = STAGES.indexOf(stage);
    const curIdx = STAGES.indexOf(current);

    if (idx < curIdx) return "✅";
    if (idx === curIdx) return "👉";
    return "⬜";
  };

  const stageNames: Record<WorkflowStage, string> = {
    intent: lang === "ru" ? "Намерение" : "Intent",
    analysis: lang === "ru" ? "Анализ" : "Analysis",
    plan: lang === "ru" ? "План" : "Plan",
    review: lang === "ru" ? "Review" : "Review",
    apply: lang === "ru" ? "Apply" : "Apply",
    verify: lang === "ru" ? "Верификация" : "Verify",
    complete: lang === "ru" ? "Готово" : "Complete",
  };

  return STAGES.map(s => `${icon(s, currentStage)} ${stageNames[s]}`).join(" → ");
}

export function formatGraphCard(
  nodes: TaskGraphNode[],
  lang: Language = "ru"
): string {
  if (nodes.length === 0) {
    return lang === "ru" ? "Нет активных задач" : "No active tasks";
  }

  const byStatus = {
    complete: nodes.filter(n => n.status === "complete"),
    running: nodes.filter(n => n.status === "running"),
    queued: nodes.filter(n => n.status === "queued" || n.status === "pending"),
    blocked: nodes.filter(n => n.status === "blocked" || n.status === "failed"),
  };

  const lines = [
    "🔗 Task Graph",
    "",
  ];

  for (const group of byStatus.complete) {
    lines.push(`✅ ${group.workflow_id.slice(-8)}`);
  }
  for (const group of byStatus.running) {
    lines.push(`🔄 ${group.workflow_id.slice(-8)}`);
  }
  for (const group of byStatus.queued) {
    lines.push(`⏳ ${group.workflow_id.slice(-8)}`);
  }
  for (const group of byStatus.blocked) {
    lines.push(`❌ ${group.workflow_id.slice(-8)}`);
  }

  return lines.join("\n");
}

export function formatErrorCard(
  workflowId: string,
  error: string,
  lang: Language = "ru"
): { text: string; keyboard: ReturnType<typeof Markup.inlineKeyboard> } {
  const lines = [
    "❌ Error",
    `Workflow: ${workflowId.slice(-8)}`,
    "",
    error.slice(0, 200),
  ];

  return {
    text: lines.join("\n"),
    keyboard: Markup.inlineKeyboard([
      [{ text: "🔍 Diagnose", callback_data: `forge:diagnose:${workflowId}` }],
      [{ text: "💊 Heal Plan", callback_data: `forge:heal:${workflowId}` }],
      [{ text: "🔄 Restart", callback_data: `forge:restart:${workflowId}` }],
    ]),
  };
}

export function canUseControl(
  control: UIControls,
  accountLabel: string,
  workflowStatus: string
): boolean {
  if (accountLabel === "★" || accountLabel === "★★") {
    return true;
  }

  if (accountLabel === "★★★") {
    const restricted = ["apply", "delete", "pause", "resume"];
    return !restricted.includes(control);
  }

  return false;
}

export function parseCallback(callback: string): { action: string; target?: string } | null {
  const parts = callback.split(":");
  if (parts.length < 2) return null;

  return {
    action: parts[1],
    target: parts[2],
  };
}