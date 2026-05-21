import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActiveCanons } from "../knowledge/strategic-canon-registry.js";
import type { PackProposal } from "../knowledge/knowledge-to-pack-generator.js";

export interface MaterializedPack {
  pack_id: string;
  plan_id: string;
  title: string;
  canons_involved: string[];
  evidence_types_needed: string[];
  modules_affected: string[];
  created_at: string;
}

let materializeCounter = 0;

export async function materializePlanToPacks(planId: string, planPhases: string[]): Promise<MaterializedPack[]> {
  materializeCounter++;
  const activeCanons = getActiveCanons();
  const packs: MaterializedPack[] = [];

  for (let i = 0; i < planPhases.length; i++) {
    const phaseCanons = activeCanons.filter((_, ci) => ci % planPhases.length === i);

    const pack: MaterializedPack = {
      pack_id: `mp_${Date.now()}_${materializeCounter}_${i + 1}`,
      plan_id: planId,
      title: `Phase ${i + 1}: ${planPhases[i]}`,
      canons_involved: phaseCanons.map((c) => c.canon_id),
      evidence_types_needed: ["strategic_canon_registered", "canon_promoted", "implementation_intent_created"],
      modules_affected: [...new Set(phaseCanons.map((c) => `src/runtime/${c.category}/`))],
      created_at: new Date().toISOString(),
    };

    packs.push(pack);

    await appendEvidenceRecord({
      evidence_id: hashTraceId(pack.pack_id, "plan_pack_materialized"),
      trace_id: pack.pack_id,
      job_id: "planning",
      type: "plan_pack_materialized",
      timestamp: pack.created_at,
      payload: {
        pack_id: pack.pack_id,
        plan_id,
        phase: i + 1,
        canons: pack.canons_involved.length,
        modules: pack.modules_affected,
      },
    });
  }

  return packs;
}
