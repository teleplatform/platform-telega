import { Workspace, WorkspaceCard, WorkspaceSection } from "./workspaceTypes";
import { MissionRegistry } from "../mission/missionRegistry.js";
import { SpaceRegistry } from "../spaces/spaceRegistry.js";
import { TaskRegistry } from "../agent-tasks/taskRegistry.js";
import { GraphRegistry } from "../agent-graph/graphRegistry.js";
import { ExecutionRegistry } from "../execution-runner/executionRegistry.js";
import { VerificationRegistry } from "../execution-verifier/verificationRegistry.js";
import { RecoveryPolicyRegistry } from "../recovery-policy/index.js";
import { GovernanceRegistry } from "../governance-engine/governanceRegistry.js";
import { ArtifactRegistry } from "../artifacts/artifactRegistry.js";
import { getAllLoopSessions } from "../autonomous-loop/loopController.js";
import { runSystemAudit } from "../system-audit/auditRunner.js";

export function buildWorkspace(): Workspace {
  const audit = runSystemAudit();

  const missions = MissionRegistry.getAll();
  const spaces = SpaceRegistry.getAll();
  const tasks = TaskRegistry.getAll();
  const graphs = GraphRegistry.getAll();
  const executions = ExecutionRegistry.getAll();
  const verifications = VerificationRegistry.getAll();
  const recoveryPlans = RecoveryPolicyRegistry.getAll();
  const decisions = GovernanceRegistry.getAll();
  const artifacts = ArtifactRegistry.getAll();
  const loops = getAllLoopSessions();

  const failedExecs = executions.filter((e) => e.status === "failed").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
  const blockedDecisions = decisions.filter((d) => d.verdict === "block").length;
  const blockedLoops = loops.filter((l) => l.status === "blocked").length;
  const reviewDecisions = decisions.filter((d) => d.verdict === "review").length;
  const failedVerifs = verifications.filter((v) => v.verdict === "failed").length;

  const totalIssues = failedExecs + blockedTasks + blockedDecisions + blockedLoops + failedVerifs;
  const systemStatus = totalIssues === 0 ? "healthy" : totalIssues <= 3 ? "degraded" : "critical";

  const cards: WorkspaceCard[] = [
    { id: "missions", title: "Missions", icon: "🎯", value: missions.length, route: "/missions" },
    { id: "spaces", title: "Spaces", icon: "📁", value: spaces.length, route: "/spaces" },
    { id: "tasks", title: "Tasks", icon: "📋", value: tasks.length, severity: blockedTasks > 0 ? "warning" : "ok", route: "/tasks" },
    { id: "graphs", title: "Graphs", icon: "🔗", value: graphs.length, route: "/graphs" },
    { id: "executions", title: "Executions", icon: "⚡", value: executions.length, severity: failedExecs > 0 ? "critical" : "ok", route: "/executions" },
    { id: "verifications", title: "Verifications", icon: "✅", value: verifications.length, severity: failedVerifs > 0 ? "critical" : "ok", route: "/verifications" },
    { id: "recovery", title: "Recovery Plans", icon: "🔄", value: recoveryPlans.length, route: "/recovery" },
    { id: "governance", title: "Governance", icon: "🛡", value: decisions.length, severity: blockedDecisions > 0 ? "critical" : reviewDecisions > 0 ? "warning" : "ok", route: "/governance" },
    { id: "loops", title: "Loops", icon: "🔄", value: loops.length, severity: blockedLoops > 0 ? "critical" : "ok", route: "/loops" },
    { id: "artifacts", title: "Artifacts", icon: "📦", value: artifacts.length, route: "/artifacts" },
  ];

  const sections: WorkspaceSection[] = [
    {
      id: "recent_missions",
      title: "Recent Missions",
      type: "list",
      items: missions.slice(-5).reverse().map((m) => ({ id: m.id, title: m.title, status: m.status })),
    },
    {
      id: "recent_executions",
      title: "Recent Executions",
      type: "list",
      items: executions.slice(-5).reverse().map((e) => ({ id: e.id, taskId: e.taskId, status: e.status, provider: e.providerId })),
    },
    {
      id: "recent_artifacts",
      title: "Recent Artifacts",
      type: "list",
      items: artifacts.slice(-5).reverse().map((a) => ({ id: a.id, title: a.title, type: a.type })),
    },
    {
      id: "pending_governance",
      title: "Pending Governance",
      type: "list",
      items: decisions.filter((d) => d.verdict === "review").slice(0, 5).map((d) => ({ id: d.id, reason: d.reason, riskScore: d.riskScore })),
    },
    {
      id: "audit_summary",
      title: "Audit Summary",
      type: "list",
      items: [
        { label: "Total Checks", value: audit.totalChecks },
        { label: "Passed", value: audit.ok, severity: "ok" },
        { label: "Warnings", value: audit.warnings, severity: audit.warnings > 0 ? "warning" : "ok" },
        { label: "Errors", value: audit.errors, severity: audit.errors > 0 ? "critical" : "ok" },
      ],
    },
  ];

  return {
    overview: {
      systemStatus,
      uptime: process.uptime(),
      lastAudit: audit.timestamp,
      totalChecks: audit.totalChecks,
      healthyChecks: audit.ok,
    },
    cards,
    sections,
    generatedAt: new Date().toISOString(),
  };
}
