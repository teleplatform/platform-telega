import { TaskGraph, GraphPlannerResult } from "./graphTypes";
import { GraphRegistry } from "./graphRegistry";

export function planGraph(graphId: string): GraphPlannerResult | null {
  const graph = GraphRegistry.get(graphId);
  if (!graph) return null;

  // Refresh from current task states
  GraphRegistry.refreshFromTasks(graphId);
  const updated = GraphRegistry.get(graphId)!;

  const readyTasks: string[] = [];
  const blockedTasks: string[] = [];
  const completedTasks: string[] = [];
  const failedTasks: string[] = [];
  const pendingTasks: string[] = [];

  for (const node of updated.nodes) {
    if (node.status === "completed") { completedTasks.push(node.taskId); continue; }
    if (node.status === "failed") { failedTasks.push(node.taskId); continue; }
    if (node.status === "running") { continue; }

    // Check dependencies
    const allDepsCompleted = node.dependsOn.every((depId) => {
      const depNode = updated.nodes.find((n) => n.taskId === depId);
      return depNode?.status === "completed" || depNode?.status === "skipped";
    });

    const anyDepFailed = node.dependsOn.some((depId) => {
      const depNode = updated.nodes.find((n) => n.taskId === depId);
      return depNode?.status === "failed";
    });

    if (anyDepFailed) {
      blockedTasks.push(node.taskId);
    } else if (allDepsCompleted) {
      readyTasks.push(node.taskId);
    } else {
      pendingTasks.push(node.taskId);
    }
  }

  // Calculate execution levels
  const levels: string[][] = [];
  const visited = new Set<string>(completedTasks);

  while (visited.size < updated.nodes.length - failedTasks.length - blockedTasks.length) {
    const level = updated.nodes.filter(
      (n) =>
        !visited.has(n.taskId) &&
        !failedTasks.includes(n.taskId) &&
        !blockedTasks.includes(n.taskId) &&
        n.dependsOn.every((d) => visited.has(d))
    );
    if (level.length === 0) break;
    const levelIds = level.map((n) => n.taskId);
    levels.push(levelIds);
    levelIds.forEach((id) => visited.add(id));
  }

  return {
    graphId,
    readyTasks,
    blockedTasks,
    completedTasks,
    failedTasks,
    pendingTasks,
    levels,
    hasBlockers: blockedTasks.length > 0,
  };
}

export function canStartTask(graphId: string, taskId: string): boolean {
  const plan = planGraph(graphId);
  if (!plan) return false;
  return plan.readyTasks.includes(taskId);
}

export function getBlockedChain(graphId: string, taskId: string): string[] {
  const graph = GraphRegistry.get(graphId);
  if (!graph) return [];

  const chain: string[] = [];
  const visited = new Set<string>();

  function walk(tid: string): boolean {
    if (visited.has(tid)) return false;
    visited.add(tid);
    const node = graph.nodes.find((n) => n.taskId === tid);
    if (!node) return false;

    if (node.status === "blocked") {
      chain.push(tid);
      return true;
    }

    for (const depId of node.dependsOn) {
      if (walk(depId)) {
        chain.push(tid);
        return true;
      }
    }
    return false;
  }

  walk(taskId);
  return chain;
}
