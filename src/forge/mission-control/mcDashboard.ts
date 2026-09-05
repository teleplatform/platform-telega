import { MissionControlDashboard, DashboardPanel, DashboardMetric, DashboardSummary, DashboardWidget } from "./mcTypes";
import { MissionRegistry } from "../mission/missionRegistry.js";
import { JobRegistry } from "../job/index.js";
import { SessionRegistry } from "../surface/sessionSurface.js";
import { SurfaceRegistry } from "../surface/surfaceRegistry.js";
import { GovernanceRegistry } from "../governance/outcomeRegistry.js";
import { PolicyRegistry } from "../policy/policyRegistry.js";
import { OverrideRegistry } from "../override/overrideRegistry.js";
import { capsuleStore } from "../capsule/capsuleStore.js";

export function buildMissionControlDashboard(): MissionControlDashboard {
  const now = new Date().toISOString();
  const surfaces = SurfaceRegistry.getAll();

  // Summary
  const missions = MissionRegistry.getAll();
  const graphs = JobRegistry.getAll();
  const sessions = SessionRegistry.getAll();
  const governanceOutcomes = GovernanceRegistry.getAll();
  const overrides = OverrideRegistry.getAll();
  const capsules = capsuleStore.getAll();
  const policies = PolicyRegistry.getAll();

  const summary: DashboardSummary = {
    totalMissions: missions.length,
    activeMissions: missions.filter((m) => m.status === "active").length,
    totalGoals: missions.reduce((s, m) => s + m.goals.length, 0),
    completedGoals: missions.reduce((s, m) => s + m.goals.filter((g) => g.status === "completed").length, 0),
    totalGraphs: graphs.length,
    runningGraphs: graphs.filter((g) => g.status === "running").length,
    totalCapsules: capsules.length,
    totalAgents: 0,
    activeAgents: 0,
    totalSessions: sessions.length,
    activeSessions: sessions.filter((s) => s.status === "active").length,
    totalOutcomes: governanceOutcomes.length,
    successRate: governanceOutcomes.length > 0
      ? Math.round((governanceOutcomes.filter((o) => o.kind.includes("success") || o.kind.includes("completed") || o.kind.includes("approved")).length / governanceOutcomes.length) * 100)
      : 0,
    policyDenials: governanceOutcomes.filter((o) => o.kind === "policy_denied").length,
    humanOverrides: governanceOutcomes.filter((o) => o.kind === "override_executed").length,
    emergencyStops: overrides.filter((o) => o.action === "emergency_stop").length,
  };

  // Panels
  const panels: DashboardPanel[] = [
    {
      id: "missions", title: "Missions", icon: "🎯", type: "grid",
      metrics: [
        { label: "Total", value: summary.totalMissions, severity: "ok" },
        { label: "Active", value: summary.activeMissions, severity: summary.activeMissions > 0 ? "ok" : "warning" },
        { label: "Goals", value: summary.totalGoals },
        { label: "Completed", value: summary.completedGoals },
      ],
    },
    {
      id: "execution", title: "Execution", icon: "⚡", type: "grid",
      metrics: [
        { label: "Graphs", value: summary.totalGraphs },
        { label: "Running", value: summary.runningGraphs, severity: summary.runningGraphs > 0 ? "ok" : "warning" },
        { label: "Capsules", value: summary.totalCapsules },
        { label: "Agents", value: summary.totalAgents },
      ],
    },
    {
      id: "sessions", title: "Sessions", icon: "💬", type: "grid",
      metrics: [
        { label: "Total", value: summary.totalSessions },
        { label: "Active", value: summary.activeSessions, severity: summary.activeSessions > 0 ? "ok" : "warning" },
      ],
    },
    {
      id: "governance", title: "Governance", icon: "🛡", type: "grid",
      metrics: [
        { label: "Outcomes", value: summary.totalOutcomes },
        { label: "Success Rate", value: `${summary.successRate}%`, severity: summary.successRate > 70 ? "ok" : "warning" },
        { label: "Policy Denials", value: summary.policyDenials, severity: summary.policyDenials > 0 ? "warning" : "ok" },
        { label: "Overrides", value: summary.humanOverrides },
        { label: "Emergency Stops", value: summary.emergencyStops, severity: summary.emergencyStops > 0 ? "critical" : "ok" },
      ],
    },
    {
      id: "policies", title: "Policies", icon: "📋", type: "list",
      metrics: [
        { label: "Total", value: policies.length },
        { label: "Enabled", value: policies.filter((p) => p.enabled).length },
      ],
    },
    {
      id: "surfaces", title: "Surfaces", icon: "🖥", type: "list",
      metrics: [
        { label: "Registered", value: surfaces.length },
        { label: "Active", value: surfaces.filter((s) => s.status === "active").length },
      ],
    },
  ];

  // Widgets
  const widgets: DashboardWidget[] = [];

  // Recent missions
  widgets.push({
    id: "recent_missions", panelId: "missions", title: "Recent Missions", type: "list",
    data: missions.slice(0, 5).map((m) => ({ id: m.id, title: m.title, status: m.status })),
  });

  // Active graphs
  widgets.push({
    id: "active_graphs", panelId: "execution", title: "Active Graphs", type: "list",
    data: graphs.filter((g) => g.status === "running").slice(0, 5).map((g) => ({ id: g.id, title: g.title, status: g.status })),
  });

  // Recent outcomes
  widgets.push({
    id: "recent_outcomes", panelId: "governance", title: "Recent Outcomes", type: "list",
    data: governanceOutcomes.slice(-5).reverse().map((o) => ({ kind: o.kind, summary: o.summary, trusted: o.trusted })),
  });

  // Surface list
  widgets.push({
    id: "surface_list", panelId: "surfaces", title: "All Surfaces", type: "list",
    data: surfaces.map((s) => ({ name: s.name, type: s.type, status: s.status })),
  });

  return {
    summary,
    panels,
    widgets,
    surfaces: surfaces.map((s) => ({ name: s.name, type: s.type, status: s.status })),
    generatedAt: now,
  };
}
