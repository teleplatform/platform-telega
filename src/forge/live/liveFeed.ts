import { LiveRuntimeStatus } from "./liveTypes";
import { MissionRegistry } from "../mission/missionRegistry.js";
import { JobRegistry } from "../job/index.js";
import { SessionRegistry } from "../surface/sessionSurface.js";
import { SurfaceRegistry } from "../surface/surfaceRegistry.js";
import { GovernanceRegistry } from "../governance/outcomeRegistry.js";

export function buildLiveStatus(): LiveRuntimeStatus {
  const missions = MissionRegistry.getAll();
  const graphs = JobRegistry.getAll();
  const sessions = SessionRegistry.getAll();
  const surfaces = SurfaceRegistry.getAll();
  const outcomes = GovernanceRegistry.getAll();

  const recentCutoff = Date.now() - 3600000; // last hour
  const recentOutcomes = outcomes.filter((o) => o.timestamp > recentCutoff);

  return {
    missions: {
      total: missions.length,
      active: missions.filter((m) => m.status === "active").length,
      failed: missions.filter((m) => m.status === "failed").length,
    },
    graphs: {
      total: graphs.length,
      running: graphs.filter((g) => g.status === "running").length,
      failed: graphs.filter((g) => g.status === "failed").length,
    },
    sessions: {
      total: sessions.length,
      active: sessions.filter((s) => s.status === "active").length,
    },
    surfaces: {
      total: surfaces.length,
      active: surfaces.filter((s) => s.status === "active").length,
    },
    outcomes: {
      total: outcomes.length,
      recent: recentOutcomes.length,
    },
    providers: {
      total: 0,
      active: 0,
    },
  };
}
