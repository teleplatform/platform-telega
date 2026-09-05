import { CreatorPanel, CreatorPermission } from "./creatorTypes";
import { CreatorRegistry } from "./creatorRegistry";

export type DispatchResult = { ok: boolean; result: string; panel: CreatorPanel };

export async function dispatchAction(
  panel: CreatorPanel,
  action: string,
  params: Record<string, unknown>
): Promise<DispatchResult> {
  switch (panel) {
    case "mission_control":
      return dispatchMissionControl(action, params);
    case "forge_dispatch":
      return dispatchForge(action, params);
    case "evidence_inspector":
      return dispatchEvidence(action, params);
    case "provider_debug":
      return dispatchProvider(action, params);
    case "override_controls":
      return dispatchOverride(action, params);
    default:
      return { ok: false, result: `Unknown panel: ${panel}`, panel };
  }
}

async function dispatchMissionControl(action: string, params: Record<string, unknown>): Promise<DispatchResult> {
  const { GovernanceRegistry } = await import("../governance/outcomeRegistry.js");
  if (action === "list_outcomes") {
    const outcomes = GovernanceRegistry.getAll();
    return { ok: true, result: `${outcomes.length} outcomes recorded`, panel: "mission_control" };
  }
  return { ok: false, result: `Unknown action: ${action}`, panel: "mission_control" };
}

async function dispatchForge(action: string, params: Record<string, unknown>): Promise<DispatchResult> {
  const { JobRegistry } = await import("../job/index.js");
  if (action === "list_graphs") {
    const graphs = JobRegistry.getAll();
    return { ok: true, result: `${graphs.length} job graphs`, panel: "forge_dispatch" };
  }
  return { ok: false, result: `Unknown action: ${action}`, panel: "forge_dispatch" };
}

async function dispatchEvidence(action: string, _params: Record<string, unknown>): Promise<DispatchResult> {
  const { getLocalProviderTraceEvents } = await import("../../providers/local/localEvidence.js");
  if (action === "list_events") {
    const events = getLocalProviderTraceEvents();
    return { ok: true, result: `${events.length} evidence events`, panel: "evidence_inspector" };
  }
  return { ok: false, result: `Unknown action: ${action}`, panel: "evidence_inspector" };
}

async function dispatchProvider(action: string, params: Record<string, unknown>): Promise<DispatchResult> {
  const { getProviderStats } = await import("../router/providerStats.js");
  if (action === "list_providers") {
    const stats = getProviderStats();
    return { ok: true, result: `${stats.length} providers tracked`, panel: "provider_debug" };
  }
  return { ok: false, result: `Unknown action: ${action}`, panel: "provider_debug" };
}

async function dispatchOverride(action: string, _params: Record<string, unknown>): Promise<DispatchResult> {
  if (action === "emergency_stop") {
    const { executeEmergencyStop } = await import("../override/emergencyStop.js");
    const result = executeEmergencyStop("Creator emergency stop", "kreator");
    return { ok: true, result: `Emergency stop executed: ${result.stopId}`, panel: "override_controls" };
  }
  return { ok: false, result: `Unknown action: ${action}`, panel: "override_controls" };
}
