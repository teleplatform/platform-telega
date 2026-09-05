import { LiveAlert } from "./liveTypes";
import { buildLiveStatus } from "./liveFeed";
import { LiveRegistry } from "./liveRegistry";

export function checkAndGenerateAlerts(): LiveAlert[] {
  const status = buildLiveStatus();
  const newAlerts: LiveAlert[] = [];

  // Check for failed graphs
  if (status.graphs.failed > 0) {
    const existing = LiveRegistry.getAlerts().find((a) => a.kind === "graph_failed" && !a.acknowledged);
    if (!existing) {
      const alert = LiveRegistry.appendAlert("graph_failed", `${status.graphs.failed} graph(s) failed`, "warning");
      newAlerts.push(alert);
    }
  }

  // Check for failed missions
  if (status.missions.failed > 0) {
    const existing = LiveRegistry.getAlerts().find((a) => a.kind === "mission_failed" && !a.acknowledged);
    if (!existing) {
      const alert = LiveRegistry.appendAlert("mission_failed", `${status.missions.failed} mission(s) failed`, "warning");
      newAlerts.push(alert);
    }
  }

  // Check for no active sessions (idle system)
  if (status.sessions.active === 0 && status.missions.total > 0) {
    const existing = LiveRegistry.getAlerts().find((a) => a.kind === "no_active_sessions" && !a.acknowledged);
    if (!existing) {
      const alert = LiveRegistry.appendAlert("no_active_sessions", "No active sessions — system idle", "warning");
      newAlerts.push(alert);
    }
  }

  return newAlerts;
}
