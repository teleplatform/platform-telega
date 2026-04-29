import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { getAccountLabel } from "./bot.js";
import fs from "fs/promises";
import path from "path";

const TIMELINES_DIR = path.join(process.cwd(), "data/forge");
const TIMELINES_FILE = path.join(TIMELINES_DIR, "timelines.jsonl");

export type TimelineEventType = 
  | "stage_started"
  | "stage_completed"
  | "stage_failed"
  | "stage_skipped"
  | "gate_passed"
  | "gate_failed"
  | "approval_granted"
  | "approval_denied"
  | "user_action"
  | "system_note";

export interface TimelineEvent {
  event_id: string;
  workflow_id: string;
  stage: string;
  type: TimelineEventType;
  actor_label: string;
  actor_id: string;
  message: string;
  evidence_refs: string[];
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface WorkflowTimeline {
  workflow_id: string;
  events: TimelineEvent[];
  created_at: number;
  updated_at: number;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TIMELINES_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addTimelineEvent(
  workflowId: string,
  stage: string,
  type: TimelineEventType,
  actorId: string,
  actorLabel: string,
  message: string,
  options?: { evidenceRefs?: string[]; metadata?: Record<string, any> }
): Promise<TimelineEvent> {
  await ensureDir();

  const event: TimelineEvent = {
    event_id: makeId("evt"),
    workflow_id: workflowId,
    stage,
    type,
    actor_id: actorId,
    actor_label: actorLabel,
    message,
    evidence_refs: options?.evidenceRefs || [],
    metadata: options?.metadata,
    timestamp: Date.now(),
  };

  try {
    const timeline: WorkflowTimeline = {
      workflow_id: workflowId,
      events: [event],
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const existing = await getTimeline(workflowId);
    if (existing) {
      existing.events.push(event);
      existing.updated_at = Date.now();
      
      const allTimelines: WorkflowTimeline[] = [];
      const content = await fs.readFile(TIMELINES_FILE, "utf-8").catch(() => "");
      const lines = content.trim().split("\n").filter(Boolean);
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as WorkflowTimeline;
          if (parsed.workflow_id === workflowId) {
            allTimelines.push(existing);
          } else {
            allTimelines.push(parsed);
          }
        } catch {}
      }
      
      const newContent = allTimelines.map(t => JSON.stringify(t)).join("\n") + "\n";
      await fs.writeFile(TIMELINES_FILE, newContent, "utf-8");
    } else {
      await fs.appendFile(TIMELINES_FILE, JSON.stringify(timeline) + "\n", "utf-8");
    }
  } catch (e) {
    console.error("[forge-timeline] add event failed", e);
  }

  console.log("[forge-timeline] event added", { workflow_id: workflowId, type, stage });

  return event;
}

export async function getTimeline(workflowId: string): Promise<WorkflowTimeline | null> {
  try {
    await ensureDir();
    const content = await fs.readFile(TIMELINES_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const timeline = JSON.parse(line) as WorkflowTimeline;
        if (timeline.workflow_id === workflowId) {
          return timeline;
        }
      } catch {}
    }
  } catch {}
  return null;
}

export async function getWorkflowTimeline(workflowId: string, lang: Language = "ru"): Promise<string> {
  const timeline = await getTimeline(workflowId);

  if (!timeline || timeline.events.length === 0) {
    return lang === "ru" ? "Нет событий" : "No events";
  }

  const lines = [
    lang === "ru" ? "📜 Timeline" : "📜 Timeline",
    "",
  ];

  for (const event of timeline.events) {
    const icon = {
      stage_started: "⏳",
      stage_completed: "✅",
      stage_failed: "❌",
      stage_skipped: "⏭️",
      gate_passed: "✅",
      gate_failed: "⛔",
      approval_granted: "👍",
      approval_denied: "👎",
      user_action: "👤",
      system_note: "📝",
    }[event.type] || "•";

    const date = new Date(event.timestamp).toLocaleString();

    lines.push(`${icon} ${event.stage} | ${event.message}`);
    lines.push(`   ${event.actor_label} | ${date}`);

    if (event.evidence_refs?.length > 0) {
      lines.push(`   Refs: ${event.evidence_refs.join(", ")}`);
    }
  }

  return lines.join("\n");
}

export function generateReport(
  workflow: any,
  timeline: TimelineEvent[],
  lang: Language = "ru"
): string {
  const lines: string[] = [];

  lines.push(lang === "ru" ? "📋 Operator Report" : "📋 Operator Report");
  lines.push(`Workflow: #${workflow.workflow_id.slice(-8)}`);
  lines.push(`Title: ${workflow.title}`);
  lines.push("");

  lines.push(lang === "ru" ? "📌 Task" : "📌 Task");
  lines.push(workflow.task);
  lines.push("");

  const stageOrder = ["intent", "analysis", "plan", "review", "apply", "verify", "complete"];
  lines.push(lang === "ru" ? "🔄 Stages" : "🔄 Stages");

  for (const stage of stageOrder) {
    const record = workflow.stages?.[stage];
    if (!record) continue;

    const icon = record.status === "completed" ? "✅" :
               record.status === "failed" ? "❌" :
               record.status === "skipped" ? "⏭️" :
               record.status === "running" ? "🔄" : "⏳";

    const gateIcon = record.gate_results?.[stage]?.passed ? "🚧" : "";

    lines.push(`${icon} ${stage} ${gateIcon}`);

    if (record.result) {
      const preview = record.result.slice(0, 100);
      lines.push(`   → ${preview}...`);
    }
    if (record.error) {
      lines.push(`   ❌ ${record.error.slice(0, 50)}`);
    }
  }

  lines.push("");

  lines.push(lang === "ru" ? "📊 Quality Gates" : "📊 Quality Gates");
  const eventGates = timeline.filter(e => e.type.startsWith("gate"));
  if (eventGates.length === 0) {
    lines.push(lang === "ru" ? "Нет gate данных" : "No gate data");
  } else {
    for (const gate of eventGates) {
      const icon = gate.type === "gate_passed" ? "✅" : "❌";
      lines.push(`${icon} ${gate.message}`);
    }
  }

  lines.push("");

  if (workflow.patch_plan_id || workflow.apply_id) {
    lines.push(lang === "ru" ? "🔗 Evidence" : "🔗 Evidence");
    if (workflow.patch_plan_id) {
      lines.push(`Plan: ${workflow.patch_plan_id}`);
    }
    if (workflow.apply_id) {
      lines.push(`Apply: ${workflow.apply_id}`);
    }
  }

  lines.push("");

  const canRollback = workflow.apply_id && workflow.current_stage !== "rolled_back";
  lines.push(lang === "ru" ? "⚙️ Actions" : "⚙️ Actions");
  lines.push(canRollback
    ? lang === "ru" ? "✓ Rollback доступен" : "✓ Rollback available"
    : lang === "ru" ? "✗ Rollback недоступен" : "✗ Rollback not available");

  lines.push("");

  lines.push(lang === "ru" ? "📅 Created" : "📅 Created");
  lines.push(new Date(workflow.created_at).toLocaleString());
  lines.push(lang === "ru" ? "📅 Updated" : "📅 Updated");
  lines.push(new Date(workflow.updated_at).toLocaleString());

  return lines.join("\n");
}

export async function exportReport(
  workflowId: string,
  workflow: any,
  lang: Language = "ru"
): Promise<{ content: string; isLong: boolean }> {
  const timeline = await getTimeline(workflowId);
  const events = timeline?.events || [];

  let content = "";

  if (workflow && events) {
    content = generateReport(workflow, events, lang);
  } else {
    content = lang === "ru" ? "Данные не найдены" : "Data not found";
  }

  const isLong = content.length > 3000;

  console.log("[forge-report] generated", { workflow_id: workflowId, length: content.length, is_long: isLong });

  return { content, isLong };
}

export async function addApprovalEvent(
  workflowId: string,
  stage: string,
  actorId: string,
  actorLabel: string,
  approved: boolean,
  lang: Language
): Promise<void> {
  const message = approved
    ? (lang === "ru" ? "Одобрено" : "Approved")
    : (lang === "ru" ? "Отклонено" : "Denied");

  const type = approved ? "approval_granted" : "approval_denied";

  await addTimelineEvent(
    workflowId,
    stage,
    type,
    actorId,
    actorLabel,
    message
  );
}