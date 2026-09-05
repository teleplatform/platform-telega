import { CreatorControlState, PendingApproval, QuickAction, ActionResult } from "./creatorControlTypes";
import { MissionRegistry } from "../mission/missionRegistry.js";
import { JobRegistry, retryFailedJobs } from "../job/index.js";
import { SessionRegistry } from "../surface/sessionSurface.js";
import { OverrideRegistry } from "../override/overrideRegistry.js";
import { GovernanceRegistry } from "../governance/outcomeRegistry.js";
import { executeEmergencyStop } from "../override/emergencyStop.js";
import { approveOverride, rejectOverride } from "../override/overrideExecutor.js";

function collectPendingApprovals(): PendingApproval[] {
  const result: PendingApproval[] = [];

  // Override requests
  const pendingOverrides = OverrideRegistry.getPending();
  for (const o of pendingOverrides) {
    result.push({
      id: o.overrideId,
      type: "override_request",
      title: `${o.action} ${o.targetType}`,
      summary: o.reason,
      source: o.requestedBy,
      createdAt: o.createdAt,
    });
  }

  return result;
}

function getQuickActions(): QuickAction[] {
  return [
    { id: "qa_pause_all", name: "Pause All Missions", description: "Pause all active missions", icon: "⏸", action: "pause_all_missions", params: {}, risk: "medium" },
    { id: "qa_resume_all", name: "Resume All Missions", description: "Resume all paused missions", icon: "▶", action: "resume_all_missions", params: {}, risk: "low" },
    { id: "qa_retry_failed", name: "Retry Failed Graphs", description: "Retry all failed job graphs", icon: "🔄", action: "retry_failed_graphs", params: {}, risk: "medium" },
    { id: "qa_emergency_stop", name: "Emergency Stop", description: "Stop all runtimes immediately", icon: "🛑", action: "emergency_stop", params: {}, risk: "critical" },
  ];
}

export function getCreatorControlState(): CreatorControlState {
  const missions = MissionRegistry.getAll();
  const graphs = JobRegistry.getAll();
  const sessions = SessionRegistry.getAll();
  const outcomes = GovernanceRegistry.getAll();

  return {
    mode: "creator",
    pendingApprovals: collectPendingApprovals(),
    quickActions: getQuickActions(),
    systemStatus: {
      missions: missions.length,
      graphs: graphs.length,
      agents: 0,
      sessions: sessions.length,
      repairs: outcomes.filter((o) => o.kind.includes("repair")).length,
      outcomes: outcomes.length,
    },
  };
}

export async function executeCreatorAction(action: string, params: Record<string, unknown>): Promise<ActionResult> {
  switch (action) {
    case "pause_all_missions": {
      let count = 0;
      for (const m of MissionRegistry.getAll()) {
        if (m.status === "active") { MissionRegistry.update(m.id, { status: "paused" }); count++; }
      }
      return { ok: true, action, message: `Paused ${count} missions`, timestamp: Date.now() };
    }
    case "resume_all_missions": {
      let count = 0;
      for (const m of MissionRegistry.getAll()) {
        if (m.status === "paused") { MissionRegistry.update(m.id, { status: "active" }); count++; }
      }
      return { ok: true, action, message: `Resumed ${count} missions`, timestamp: Date.now() };
    }
    case "retry_failed_graphs": {
      const graphs = JobRegistry.getAll();
      let count = 0;
      for (const g of graphs) {
        if (g.status === "failed") { retryFailedJobs(g.id); count++; }
      }
      return { ok: true, action, message: `Retrying ${count} graphs`, timestamp: Date.now() };
    }
    case "emergency_stop": {
      const result = executeEmergencyStop("Creator Control emergency stop", "kreator");
      return { ok: true, action, message: `Emergency stop: ${result.stopId}`, timestamp: Date.now() };
    }
    default:
      return { ok: false, action, message: `Unknown action: ${action}`, timestamp: Date.now() };
  }
}
