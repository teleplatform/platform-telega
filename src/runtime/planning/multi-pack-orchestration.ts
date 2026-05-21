import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface OrchestratedPack {
  pack_id: string;
  requires: string[];
  blocked_by: string[];
  sequence: number;
}

export interface OrchestrationPlan {
  orchestration_id: string;
  packs: OrchestratedPack[];
  total_phases: number;
  critical_path: string[];
  created_at: string;
}

let orchestrationCounter = 0;

export function createOrchestration(packIds: string[]): OrchestrationPlan {
  orchestrationCounter++;

  const packs: OrchestratedPack[] = packIds.map((id, i) => ({
    pack_id: id,
    requires: i > 0 ? [packIds[i - 1]] : [],
    blocked_by: [],
    sequence: i + 1,
  }));

  for (let i = 1; i < packs.length; i++) {
    packs[i].blocked_by = packs[i - 1].requires;
  }

  const criticalPath = packs.map((p) => p.pack_id);

  const plan: OrchestrationPlan = {
    orchestration_id: `orch_${Date.now()}_${orchestrationCounter}`,
    packs,
    total_phases: packs.length,
    critical_path: criticalPath,
    created_at: new Date().toISOString(),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(plan.orchestration_id, "multi_pack_orchestration_created"),
    trace_id: plan.orchestration_id,
    job_id: "planning",
    type: "multi_pack_orchestration_created",
    timestamp: plan.created_at,
    payload: {
      orchestration_id: plan.orchestration_id,
      total_packs: packs.length,
      critical_path_length: criticalPath.length,
    },
  });

  return plan;
}
