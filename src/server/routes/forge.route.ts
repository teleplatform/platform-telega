import fs from "fs/promises";
import path from "path";

const WORKFLOWS_DIR = path.join(process.cwd(), "data/forge");

interface ForgeRecord {
  workflow_id: string;
  user_id: string;
  account_label: string;
  title: string;
  task: string;
  current_stage: string;
  stages: Record<string, any>;
  can_continue: boolean;
  error?: string;
  created_at: number;
  updated_at: number;
}

interface TaskRecord {
  task_id: string;
  user_id: string;
  account_label: string;
  task: string;
  status: string;
  created_at: number;
  updated_at: number;
}

interface TimelineRecord {
  timeline_id: string;
  workflow_id: string;
  stage: string;
  event: string;
  actor: string;
  detail: string;
  timestamp: number;
}

interface GraphRecord {
  graph_id: string;
  workflow_id: string;
  tasks: Array<{ task_id: string; parent_ids: string[]; status: string }>;
  created_at: number;
}

interface CheckpointRecord {
  checkpoint_id: string;
  workflow_id: string;
  stage: string;
  state_snapshot: any;
  created_at: number;
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as T[];
  } catch {
    return [];
  }
}

async function ensureDir() {
  try {
    await fs.mkdir(WORKFLOWS_DIR, { recursive: true });
  } catch {}
}

export async function registerForgeRoute(server: any) {
  await ensureDir();

  server.get("/forge/workflows", async (_req: any, _reply: any) => {
    const workflows = await readJsonl<ForgeRecord>(
      path.join(WORKFLOWS_DIR, "workflows.jsonl")
    );
    return { workflows };
  });

  server.get("/forge/tasks", async (_req: any, _reply: any) => {
    const tasks = await readJsonl<TaskRecord>(
      path.join(WORKFLOWS_DIR, "tasks.jsonl")
    );
    return { tasks };
  });

  server.get("/forge/timelines", async (_req: any, _reply: any) => {
    const timelines = await readJsonl<TimelineRecord>(
      path.join(WORKFLOWS_DIR, "timelines.jsonl")
    );
    return { timelines };
  });

  server.get("/forge/task-graph", async (_req: any, _reply: any) => {
    const graphs = await readJsonl<GraphRecord>(
      path.join(WORKFLOWS_DIR, "task-graph.jsonl")
    );
    return { graphs };
  });

  server.get("/forge/checkpoints", async (_req: any, _reply: any) => {
    const checkpoints = await readJsonl<CheckpointRecord>(
      path.join(WORKFLOWS_DIR, "checkpoints.jsonl")
    );
    return { checkpoints };
  });

  server.get("/forge/heal-plans", async (_req: any, _reply: any) => {
    const healPlans = await readJsonl<any>(
      path.join(WORKFLOWS_DIR, "heal-plans.jsonl")
    );
    return { healPlans };
  });

  server.get("/forge/dashboard", async (_req: any, _reply: any) => {
    const workflows = await readJsonl<ForgeRecord>(
      path.join(WORKFLOWS_DIR, "workflows.jsonl")
    );
    const tasks = await readJsonl<TaskRecord>(
      path.join(WORKFLOWS_DIR, "tasks.jsonl")
    );
    const checkpoints = await readJsonl<CheckpointRecord>(
      path.join(WORKFLOWS_DIR, "checkpoints.jsonl")
    );
    const healPlans = await readJsonl<any>(
      path.join(WORKFLOWS_DIR, "heal-plans.jsonl")
    );

    const active = workflows.filter((w) => w.current_stage !== "complete");
    const stalled = active.filter(
      (w) => w.error || w.stages?.[w.current_stage]?.status === "failed"
    );
    const awaitingApproval = active.filter((w) => w.current_stage === "review");

    return {
      stats: {
        totalWorkflows: workflows.length,
        activeWorkflows: active.length,
        stalledWorkflows: stalled.length,
        awaitingApproval: awaitingApproval.length,
        totalTasks: tasks.length,
        totalCheckpoints: checkpoints.length,
        pendingHeals: healPlans.filter((h) => h.status === "pending" || h.status === "created").length,
      },
      recentWorkflows: workflows.slice(-10).reverse(),
    };
  });

  server.get("/forge/auto-modes", async (_req: any, _reply: any) => {
    const autoModes = await readJsonl<any>(
      path.join(WORKFLOWS_DIR, "auto-modes.jsonl")
    );
    return { autoModes };
  });

  server.get("/forge/action-cards", async (req: any, _reply: any) => {
    const workflows = await readJsonl<ForgeRecord>(
      path.join(WORKFLOWS_DIR, "workflows.jsonl")
    );

    const active = workflows.filter((w) => w.current_stage !== "complete");
    const stalled = active.filter(
      (w) => w.error || w.stages?.[w.current_stage]?.status === "failed"
    );
    const pendingHeals = await readJsonl<any>(
      path.join(WORKFLOWS_DIR, "heal-plans.jsonl")
    ).then((plans) => plans.filter((p: any) => p.status === "pending"));

    const context = {
      role: req.query.role ?? "★★★",
      has_active_workflow: active.length > 0,
      has_stalled_workflow: stalled.length > 0,
      has_pending_heal: pendingHeals.length > 0,
      current_workflow_id: active[0]?.workflow_id,
    };

    const { findActionCards, renderActionCard } = await import("../../lib/commands.js");
    const cards = findActionCards(context);

    return {
      context,
      cards: cards.slice(0, 2).map((card) => ({
        card_id: card.card_id,
        title_ru: card.title_ru,
        title_en: card.title_en,
        description_ru: card.description_ru,
        description_en: card.description_en,
        severity: card.severity,
        commands: card.commands,
      })),
    };
  });
}