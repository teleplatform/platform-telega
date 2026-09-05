import { OverrideRequest, OverrideResult, OverrideAction, OverrideTargetType } from "./overrideTypes";
import { OverrideRegistry } from "./overrideRegistry";
import { MissionRegistry } from "../mission/missionRegistry.js";
import { JobRegistry, cancelGraph, retryFailedJobs } from "../job/index.js";

function executeMissionAction(missionId: string, action: OverrideAction): OverrideResult {
  const mission = MissionRegistry.get(missionId);
  const refs: string[] = [`override:mission:${missionId}:${action}`];

  if (mission) {
    switch (action) {
      case "pause":
        if (mission && mission.status === "active") MissionRegistry.update(missionId, { status: "paused" });
        break;
      case "resume":
        if (mission && mission.status === "paused") MissionRegistry.update(missionId, { status: "active" });
        break;
      case "cancel":
        if (mission) MissionRegistry.update(missionId, { status: "cancelled" });
        break;
    }
  }

  return { overrideId: "", action, success: true, affectedObjects: [missionId], evidenceRefs: refs, timestamp: Date.now() };
}

function executeGraphAction(graphId: string, action: OverrideAction): OverrideResult {
  const refs: string[] = [`override:graph:${graphId}:${action}`];

  switch (action) {
    case "cancel":
      cancelGraph(graphId);
      break;
    case "retry":
      retryFailedJobs(graphId);
      break;
  }

  return { overrideId: "", action, success: true, affectedObjects: [graphId], evidenceRefs: refs, timestamp: Date.now() };
}

export function executeOverride(requestId: string): OverrideResult {
  const req = OverrideRegistry.get(requestId);
  if (!req) {
    return { overrideId: requestId, action: "pause" as OverrideAction, success: false, affectedObjects: [], evidenceRefs: [], timestamp: Date.now(), error: "Override request not found" };
  }

  let result: OverrideResult;

  switch (req.targetType) {
    case "mission":
      result = executeMissionAction(req.targetId, req.action);
      break;
    case "graph":
      result = executeGraphAction(req.targetId, req.action);
      break;
    default:
      result = { overrideId: requestId, action: req.action, success: true, affectedObjects: [req.targetId], evidenceRefs: [`override:${req.overrideId}:${req.action}`], timestamp: Date.now() };
  }

  result.overrideId = requestId;
  OverrideRegistry.updateStatus(requestId, result.success ? "executed" : "failed", result.success ? "Executed successfully" : "Failed to execute");

  return result;
}

export function approveOverride(requestId: string): OverrideResult | null {
  const req = OverrideRegistry.get(requestId);
  if (!req) return null;
  OverrideRegistry.updateStatus(requestId, "approved");
  return executeOverride(requestId);
}

export function rejectOverride(requestId: string): OverrideRequest | null {
  return OverrideRegistry.updateStatus(requestId, "rejected", "Rejected by human operator");
}
