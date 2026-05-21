import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type ResourceType = "compute" | "memory" | "operator_attention" | "federation_pressure" | "economy";

export interface ResourceCheck {
  check_id: string;
  resource: ResourceType;
  available: number;
  required: number;
  pressure: boolean;
  checked_at: string;
}

export interface ResourceGovernorState {
  governor_id: string;
  checks: ResourceCheck[];
  total_pressure: boolean;
  blocked: boolean;
  checked_at: string;
}

let governorCounter = 0;

const RESOURCE_LIMITS: Record<ResourceType, number> = {
  compute: 100,
  memory: 100,
  operator_attention: 5,
  federation_pressure: 80,
  economy: 100,
};

let currentUsage: Record<ResourceType, number> = {
  compute: 0,
  memory: 0,
  operator_attention: 0,
  federation_pressure: 0,
  economy: 0,
};

export function updateResourceUsage(resource: ResourceType, amount: number): void {
  currentUsage[resource] = Math.max(0, currentUsage[resource] + amount);
}

export async function checkResourceAvailability(required: Partial<Record<ResourceType, number>>): Promise<ResourceGovernorState> {
  governorCounter++;
  const checks: ResourceCheck[] = [];

  for (const [resourceStr, req] of Object.entries(required)) {
    const resource = resourceStr as ResourceType;
    const limit = RESOURCE_LIMITS[resource];
    const available = limit - currentUsage[resource];
    const pressure = req > available;

    checks.push({
      check_id: `rc_${Date.now()}_${governorCounter}_${resource}`,
      resource,
      available,
      required: req,
      pressure,
      checked_at: new Date().toISOString(),
    });
  }

  const totalPressure = checks.some((c) => c.pressure);
  const blocked = totalPressure;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`rg_${governorCounter}`, totalPressure ? "planning_resource_pressure_detected" : "planning_resource_check_completed"),
    trace_id: `rg_${governorCounter}`,
    job_id: "planning",
    type: totalPressure ? "planning_resource_pressure_detected" : "planning_resource_check_completed",
    timestamp: new Date().toISOString(),
    payload: {
      governor_id: `rg_${governorCounter}`,
      total_pressure: totalPressure,
      blocked,
      checks: checks.map((c) => ({ resource: c.resource, available: c.available, required: c.required, pressure: c.pressure })),
    },
  });

  return {
    governor_id: `rg_${governorCounter}`,
    checks,
    total_pressure: totalPressure,
    blocked,
    checked_at: new Date().toISOString(),
  };
}
