import { MissionWorkspace, MissionWorkspaceCard, MissionWorkspaceSection } from "./missionWorkspaceTypes";
import { MissionRegistry } from "../mission/missionRegistry.js";
import { SpaceRegistry } from "../spaces/spaceRegistry.js";
import { TaskRegistry } from "../agent-tasks/taskRegistry.js";
import { GraphRegistry } from "../agent-graph/graphRegistry.js";
import { ExecutionRegistry } from "../execution-runner/executionRegistry.js";
import { VerificationRegistry } from "../execution-verifier/verificationRegistry.js";
import { ArtifactRegistry } from "../artifacts/artifactRegistry.js";
import { buildTimeline } from "../mission-timeline/timelineBuilder.js";
import { exploreEvidence } from "../evidence-explorer/evidenceExplorerBuilder.js";

export function buildMissionWorkspace(missionId: string): MissionWorkspace | null {
  const mission = MissionRegistry.get(missionId);
  if (!mission) return null;

  // Collect linked spaces, tasks
  const spaces = SpaceRegistry.getAll().filter((s) => s.missionId === missionId);
  const tasks = TaskRegistry.getAll().filter((t) => t.binding.missionId === missionId);
  const graphs = GraphRegistry.getAll().filter((g) => g.missionId === missionId);
  const executions = ExecutionRegistry.getAll().filter((e) => {
    const task = tasks.find((t) => t.id === e.taskId);
    return !!task;
  });
  const taskIds = tasks.map((t) => t.id);
  const verifications = VerificationRegistry.getAll().filter((v) => taskIds.includes(v.taskId));
  const artifacts = ArtifactRegistry.getAll().filter((a) => a.missionId === missionId);
  const evidence = exploreEvidence(missionId);
  const timeline = buildTimeline(missionId);

  const runningExecs = executions.filter((e) => e.status === "running").length;
  const failedExecs = executions.filter((e) => e.status === "failed").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
  const failedVerifs = verifications.filter((v) => v.verdict === "failed").length;

  const totalIssues = failedExecs + blockedTasks + failedVerifs;
  const health = totalIssues === 0 ? "healthy" : totalIssues <= 2 ? "degraded" : "critical";

  const cards: MissionWorkspaceCard[] = [
    { label: "Spaces", value: spaces.length, icon: "📁" },
    { label: "Tasks", value: tasks.length, icon: "📋", severity: blockedTasks > 0 ? "warning" : "ok" },
    { label: "Graphs", value: graphs.length, icon: "🔗" },
    { label: "Executions", value: executions.length, icon: "⚡", severity: runningExecs > 0 ? "ok" : "warning" },
    { label: "Running", value: runningExecs, icon: "▶", severity: runningExecs > 0 ? "ok" : "warning" },
    { label: "Verifications", value: verifications.length, icon: "✅", severity: failedVerifs > 0 ? "critical" : "ok" },
    { label: "Evidence", value: evidence.length, icon: "📊" },
    { label: "Artifacts", value: artifacts.length, icon: "📦" },
    { label: "Timeline Events", value: timeline.eventCount, icon: "📅" },
  ];

  const sections: MissionWorkspaceSection[] = [
    {
      id: "spaces", title: "Spaces", type: "list",
      items: spaces.map((s) => ({ id: s.id, name: s.name, status: s.status, agentCount: s.agentIds.length, taskCount: s.taskIds.length })),
    },
    {
      id: "tasks", title: "Tasks", type: "list",
      items: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, agent: t.binding.agentId })),
    },
    {
      id: "graphs", title: "Graphs", type: "list",
      items: graphs.map((g) => ({ id: g.id, name: g.name, status: g.status, nodes: g.nodes.length, edges: g.edges.length })),
    },
    {
      id: "recent_artifacts", title: "Recent Artifacts", type: "list",
      items: artifacts.slice(-5).reverse().map((a) => ({ id: a.id, title: a.title, type: a.type })),
    },
    {
      id: "timeline", title: "Timeline", type: "list",
      items: timeline.events.slice(-5).reverse().map((e) => ({ kind: e.kind, title: e.title, timestamp: e.timestamp, source: e.source })),
    },
  ];

  return {
    mission,
    missionId,
    cards,
    sections,
    health,
    generatedAt: new Date().toISOString(),
  };
}
