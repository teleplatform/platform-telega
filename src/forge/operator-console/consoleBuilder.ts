import { OperatorConsole, ConsoleSummaryCard, ConsoleSection } from "./consoleTypes";
import { MissionRegistry } from "../mission/missionRegistry.js";
import { JobRegistry } from "../job/index.js";
import { SessionRegistry } from "../surface/sessionSurface.js";
import { SurfaceRegistry } from "../surface/surfaceRegistry.js";
import { GovernanceRegistry } from "../governance/outcomeRegistry.js";
import { OverrideRegistry } from "../override/overrideRegistry.js";
import { PolicyRegistry } from "../policy/policyRegistry.js";
import { capsuleStore } from "../capsule/capsuleStore.js";

export function buildOperatorConsole(): OperatorConsole {
  const surfaces = SurfaceRegistry.getAll();
  const missions = MissionRegistry.getAll();
  const graphs = JobRegistry.getAll();
  const sessions = SessionRegistry.getAll();
  const outcomes = GovernanceRegistry.getAll();
  const overrides = OverrideRegistry.getAll();
  const policies = PolicyRegistry.getAll();
  const capsules = capsuleStore.getAll();

  // Summary cards
  const summaryCards: ConsoleSummaryCard[] = [
    { id: "missions", label: "Missions", value: missions.length, icon: "🎯", trend: "stable", severity: "ok" },
    { id: "active_missions", label: "Active", value: missions.filter((m) => m.status === "active").length, icon: "▶", trend: "up", severity: missions.filter((m) => m.status === "active").length > 0 ? "ok" : "warning" },
    { id: "graphs", label: "Graphs", value: graphs.length, icon: "⚡", trend: "stable", severity: "ok" },
    { id: "running_graphs", label: "Running", value: graphs.filter((g) => g.status === "running").length, icon: "🔄", trend: graphs.filter((g) => g.status === "running").length > 0 ? "up" : "stable", severity: graphs.filter((g) => g.status === "running").length > 0 ? "ok" : "warning" },
    { id: "capsules", label: "Capsules", value: capsules.length, icon: "📦", severity: "ok" },
    { id: "sessions", label: "Sessions", value: sessions.length, icon: "💬", severity: "ok" },
    { id: "active_sessions", label: "Active Sessions", value: sessions.filter((s) => s.status === "active").length, icon: "🟢", severity: sessions.filter((s) => s.status === "active").length > 0 ? "ok" : "warning" },
    { id: "outcomes", label: "Outcomes", value: outcomes.length, icon: "📊", severity: "ok" },
    { id: "success_rate", label: "Success Rate", value: outcomes.length > 0 ? `${Math.round((outcomes.filter((o) => !o.kind.includes("failed") && !o.kind.includes("denied")).length / outcomes.length) * 100)}%` : "—", icon: "✅", severity: outcomes.length > 0 && (outcomes.filter((o) => !o.kind.includes("failed") && !o.kind.includes("denied")).length / outcomes.length) > 0.7 ? "ok" : "warning" },
    { id: "denials", label: "Policy Denials", value: outcomes.filter((o) => o.kind === "policy_denied").length, icon: "🚫", severity: outcomes.filter((o) => o.kind === "policy_denied").length > 0 ? "warning" : "ok" },
    { id: "overrides", label: "Overrides", value: overrides.length, icon: "🛡", severity: overrides.length > 0 ? "warning" : "ok" },
    { id: "surfaces", label: "Surfaces", value: surfaces.length, icon: "🖥", severity: "ok" },
  ];

  // Sections
  const sections: ConsoleSection[] = [
    {
      id: "active_missions_list",
      title: "Active Missions",
      type: "list",
      data: missions.filter((m) => m.status === "active" || m.status === "draft").slice(0, 10).map((m) => ({
        id: m.id, title: m.title, status: m.status, goals: m.goals.length, graphs: m.graphIds.length,
      })),
    },
    {
      id: "running_graphs_list",
      title: "Running / Failed Graphs",
      type: "list",
      data: graphs.filter((g) => g.status === "running" || g.status === "failed").slice(0, 10).map((g) => ({
        id: g.id, title: g.title, status: g.status, nodes: g.nodes.length,
      })),
    },
    {
      id: "pending_approvals",
      title: "Pending Approvals",
      type: "list",
      data: OverrideRegistry.getPending().map((o) => ({
        id: o.overrideId, action: o.action, targetType: o.targetType, reason: o.reason, requestedBy: o.requestedBy, createdAt: o.createdAt,
      })),
    },
    {
      id: "recent_outcomes",
      title: "Recent Outcomes",
      type: "digest",
      data: outcomes.slice(-8).reverse().map((o) => ({
        kind: o.kind, source: o.source, severity: o.severity, summary: o.summary, trusted: o.trusted,
      })),
    },
    {
      id: "surface_status",
      title: "Surface Status",
      type: "list",
      data: surfaces.map((s) => ({ name: s.name, type: s.type, status: s.status, capabilities: s.capabilities.map((c) => c.name) })),
    },
    {
      id: "governance_digest",
      title: "Governance Digest",
      type: "digest",
      data: {
        policies: policies.length,
        enabledPolicies: policies.filter((p) => p.enabled).length,
        totalOutcomes: outcomes.length,
        trustedOutcomes: outcomes.filter((o) => o.trusted).length,
        approvedProposals: 0,
        rejectedProposals: 0,
      },
    },
  ];

  return {
    summaryCards,
    sections,
    mode: "operator",
    generatedAt: new Date().toISOString(),
  };
}
