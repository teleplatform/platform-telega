import { SpaceWorkspace, SpaceWorkspaceCard, SpaceWorkspaceSection } from "./spaceWorkspaceTypes";
import { SpaceRegistry } from "../spaces/spaceRegistry.js";
import { TaskRegistry } from "../agent-tasks/taskRegistry.js";
import { GraphRegistry } from "../agent-graph/graphRegistry.js";
import { ExecutionRegistry } from "../execution-runner/executionRegistry.js";
import { ArtifactRegistry } from "../artifacts/artifactRegistry.js";
import { exploreEvidence } from "../evidence-explorer/evidenceExplorerBuilder.js";

export function buildSpaceWorkspace(spaceId: string): SpaceWorkspace | null {
  const space = SpaceRegistry.get(spaceId);
  if (!space) return null;

  // Collect data linked to this space
  const tasks = TaskRegistry.getAll().filter((t) => t.binding.spaceId === spaceId);
  const graphs = GraphRegistry.getAll().filter((g) => g.spaceId === spaceId);
  const taskIds = tasks.map((t) => t.id);
  const executions = ExecutionRegistry.getAll().filter((e) => taskIds.includes(e.taskId));
  const artifacts = ArtifactRegistry.getAll().filter((a) => a.spaceId === spaceId);
  const evidence = exploreEvidence(undefined, spaceId);

  const runningExecs = executions.filter((e) => e.status === "running").length;
  const failedExecs = executions.filter((e) => e.status === "failed").length;
  const failedTasks = tasks.filter((t) => t.status === "failed").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;

  const totalIssues = failedExecs + failedTasks + blockedTasks;
  const health = totalIssues === 0 ? "healthy" : totalIssues <= 2 ? "degraded" : "critical";

  const cards: SpaceWorkspaceCard[] = [
    { label: "Agents", value: space.agentIds.length, icon: "🤖" },
    { label: "Tasks", value: tasks.length, icon: "📋", severity: blockedTasks > 0 ? "warning" : failedTasks > 0 ? "critical" : "ok" },
    { label: "Running", value: runningExecs, icon: "▶", severity: runningExecs > 0 ? "ok" : "warning" },
    { label: "Failed Tasks", value: failedTasks, icon: "❌", severity: failedTasks > 0 ? "critical" : "ok" },
    { label: "Graphs", value: graphs.length, icon: "🔗" },
    { label: "Executions", value: executions.length, icon: "⚡" },
    { label: "Artifacts", value: artifacts.length, icon: "📦" },
    { label: "Evidence", value: evidence.length, icon: "📊" },
  ];

  const sections: SpaceWorkspaceSection[] = [
    {
      id: "agents", title: "Agent Members", type: "list",
      items: space.agentIds.map((aid) => ({ agentId: aid })),
    },
    {
      id: "tasks", title: "Task Queue", type: "list",
      items: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, agentId: t.binding.agentId })),
    },
    {
      id: "graphs", title: "Graph Queue", type: "list",
      items: graphs.map((g) => ({ id: g.id, name: g.name, status: g.status, nodes: g.nodes.length })),
    },
    {
      id: "recent_artifacts", title: "Recent Artifacts", type: "list",
      items: artifacts.slice(-5).reverse().map((a) => ({ id: a.id, title: a.title, type: a.type })),
    },
  ];

  return {
    spaceId,
    spaceName: space.name,
    cards,
    sections,
    health,
    generatedAt: new Date().toISOString(),
  };
}
