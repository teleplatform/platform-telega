import { detectLanguage, Language } from "../providers/creator/i18n.js";
import { getAccountLabel } from "./bot.js";
import fs from "fs/promises";
import path from "path";

const GRAPH_DIR = path.join(process.cwd(), "data/forge");
const GRAPH_FILE = path.join(GRAPH_DIR, "task-graph.jsonl");

export type GraphNodeStatus = "pending" | "queued" | "running" | "complete" | "failed" | "blocked";

export interface TaskGraphNode {
  workflow_id: string;
  parent_id?: string;
  depends_on: string[];
  status: GraphNodeStatus;
  priority: number;
  parallel_group?: string;
  created_at: number;
  started_at?: number;
  completed_at?: number;
}

const MAX_CONCURRENT = 3;
const activeWorkflows = new Map<string, NodeJS.Timeout>();
const pendingQueue: string[] = [];
const runningNodes = new Map<string, TaskGraphNode>();

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(GRAPH_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function initGraphNode(
  workflowId: string,
  options?: { parentId?: string; dependsOn?: string[]; priority?: number; parallelGroup?: string }
): Promise<TaskGraphNode> {
  await ensureDir();

  const node: TaskGraphNode = {
    workflow_id: workflowId,
    parent_id: options?.parentId,
    depends_on: options?.dependsOn || [],
    status: "queued",
    priority: options?.priority || 0,
    parallel_group: options?.parallelGroup,
    created_at: Date.now(),
  };

  runningNodes.set(workflowId, node);

  const allNodes = await loadAllNodes();
  allNodes.push(node);

  await saveAllNodes(allNodes);

  console.log("[forge-graph] node created", { workflow_id: workflowId, depends_on: options?.dependsOn });

  return node;
}

async function loadAllNodes(): Promise<TaskGraphNode[]> {
  const nodes: TaskGraphNode[] = [];

  try {
    await ensureDir();
    const content = await fs.readFile(GRAPH_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const node = JSON.parse(line) as TaskGraphNode;
        nodes.push(node);
      } catch {}
    }
  } catch {}

  return nodes;
}

async function saveAllNodes(nodes: TaskGraphNode[]): Promise<void> {
  await ensureDir();
  const content = nodes.map(n => JSON.stringify(n)).join("\n") + "\n";
  await fs.writeFile(GRAPH_FILE, content, "utf-8");
}

export async function getGraphNode(workflowId: string): Promise<TaskGraphNode | null> {
  return runningNodes.get(workflowId) || null;
}

export async function canRunNode(workflowId: string): Promise<boolean> {
  const node = await getGraphNode(workflowId);
  if (!node) return false;

  const allNodes = await loadAllNodes();

  for (const depId of node.depends_on) {
    const depNode = allNodes.find(n => n.workflow_id === depId);
    if (!depNode || depNode.status !== "complete") {
      return false;
    }
  }

  const currentRunning = allNodes.filter(n => n.status === "running").length;
  if (currentRunning >= MAX_CONCURRENT) {
    return false;
  }

  return true;
}

export async function updateNodeStatus(
  workflowId: string,
  status: GraphNodeStatus
): Promise<void> {
  const node = await getGraphNode(workflowId);
  if (!node) return;

  node.status = status;

  if (status === "running") {
    node.started_at = Date.now();
  } else if (status === "complete" || status === "failed") {
    node.completed_at = Date.now();
  }

  const allNodes = await loadAllNodes();
  const idx = allNodes.findIndex(n => n.workflow_id === workflowId);
  if (idx >= 0) {
    allNodes[idx] = node;
  }

  await saveAllNodes(allNodes);

  console.log("[forge-graph] status updated", { workflow_id: workflowId, status });
}

export async function checkDependencies(workflowId: string): Promise<{ blocked: boolean; reason?: string }> {
  const node = await getGraphNode(workflowId);
  if (!node) return { blocked: false };

  const allNodes = await loadAllNodes();

  for (const depId of node.depends_on) {
    const depNode = allNodes.find(n => n.workflow_id === depId);
    if (!depNode) continue;

    if (depNode.status === "pending" || depNode.status === "queued") {
      return { blocked: true, reason: `Waiting for ${depId.slice(-8)}` };
    }
    if (depNode.status === "failed") {
      return { blocked: true, reason: `Dependency ${depId.slice(-8)} failed` };
    }
  }

  return { blocked: false };
}

export function formatGraph(lang: Language = "ru"): string {
  const lines = [lang === "ru" ? "🔗 Task Graph" : "🔗 Task Graph"];

  const allNodes = Array.from(runningNodes.values());

  if (allNodes.length === 0) {
    return lang === "ru" ? "Нет задач в графе" : "No tasks in graph";
  }

  const byStatus = {
    complete: allNodes.filter(n => n.status === "complete"),
    running: allNodes.filter(n => n.status === "running"),
    queued: allNodes.filter(n => n.status === "queued" || n.status === "pending"),
    blocked: allNodes.filter(n => n.status === "blocked"),
    failed: allNodes.filter(n => n.status === "failed"),
  };

  if (byStatus.complete.length > 0) {
    lines.push("\n✅ Complete:");
    for (const n of byStatus.complete) {
      lines.push(`  ✓ ${n.workflow_id.slice(-8)}`);
    }
  }

  if (byStatus.running.length > 0) {
    lines.push("\n🔄 Running:");
    for (const n of byStatus.running) {
      lines.push(`  → ${n.workflow_id.slice(-8)}`);
    }
  }

  if (byStatus.queued.length > 0) {
    lines.push("\n⏳ Queued:");
    for (const n of byStatus.queued) {
      lines.push(`  ○ ${n.workflow_id.slice(-8)}`);
    }
  }

  if (byStatus.blocked.length > 0) {
    lines.push("\n⛔ Blocked:");
    for (const n of byStatus.blocked) {
      lines.push(`  ⊘ ${n.workflow_id.slice(-8)}`);
    }
  }

  if (byStatus.failed.length > 0) {
    lines.push("\n❌ Failed:");
    for (const n of byStatus.failed) {
      lines.push(`  ✗ ${n.workflow_id.slice(-8)}`);
    }
  }

  return lines.join("\n");
}

export function formatQueue(lang: Language = "ru"): string {
  const allNodes = Array.from(runningNodes.values());

  const queued = allNodes
    .filter(n => n.status === "queued" || n.status === "pending")
    .sort((a, b) => b.priority - a.priority);

  if (queued.length === 0) {
    return lang === "ru" ? "Очередь пуста" : "Queue empty";
  }

  const lines = [lang === "ru" ? "📋 Queue" : "📋 Queue"];
  lines.push("");

  for (let i = 0; i < Math.min(queued.length, 10); i++) {
    const n = queued[i];
    const pr = n.priority > 0 ? ` [P${n.priority}]` : "";
    lines.push(`${i + 1}. ${n.workflow_id.slice(-8)}${pr}`);
  }

  const currentRunning = allNodes.filter(n => n.status === "running").length;
  lines.push(`\nRunning: ${currentRunning}/${MAX_CONCURRENT}`);

  return lines.join("\n");
}

export async function linkToParent(childId: string, parentId: string): Promise<void> {
  const child = await getGraphNode(childId);
  if (!child) return;

  child.parent_id = parentId;
  child.depends_on.push(parentId);

  console.log("[forge-graph] linked", { child: childId, parent: parentId });
}

export async function spawnChildWorkflow(
  parentId: string,
  taskDescription: string,
  lang: Language
): Promise<{ workflow_id?: string; error?: string }> {
  const parentNode = await getGraphNode(parentId);
  if (!parentNode) {
    return { error: "Parent workflow not found in graph" };
  }

  console.log("[forge-graph] spawning child", { parent: parentId, task: taskDescription.slice(0, 30) });

  return { workflow_id: `child_${makeId("wf")}` };
}