import { OverrideResult } from "./overrideTypes";
import { OverrideRegistry } from "./overrideRegistry";

let emergencyStopCount = 0;

export function executeEmergencyStop(reason: string, requestedBy: string): { stopId: string; result: OverrideResult } {
  emergencyStopCount++;

  const req = OverrideRegistry.create("system", "system", "emergency_stop", reason, requestedBy);
  const stopId = `em_stop_${emergencyStopCount}_${Date.now()}`;

  const result: OverrideResult = {
    overrideId: req.overrideId,
    action: "emergency_stop",
    success: true,
    affectedObjects: [
      "Mission Runtime",
      "Execution Runtime",
      "Repair Runtime",
      "Job Graph Engine",
      "Multi-Agent Execution",
    ],
    evidenceRefs: [
      `emergency_stop:${stopId}`,
      `reason:${reason}`,
      `requested_by:${requestedBy}`,
    ],
    timestamp: Date.now(),
  };

  OverrideRegistry.updateStatus(req.overrideId, "executed", `Emergency stop: ${reason}`);

  return { stopId, result };
}

export function getEmergencyStopCount(): number {
  return emergencyStopCount;
}
