import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

export interface EvidenceBundle {
  bundle_id: string;
  plan_id: string;
  evidence_ids: string[];
  total_count: number;
  created_at: string;
}

let bundleCounter = 0;

export function createPlanEvidenceBundle(planId: string): EvidenceBundle {
  bundleCounter++;
  const allEvidence = readEvidenceRecords();
  const planEvidence = allEvidence.filter((e) => e.payload?.plan_id === planId || e.trace_id === planId);

  const bundle: EvidenceBundle = {
    bundle_id: `bundle_${Date.now()}_${bundleCounter}`,
    plan_id: planId,
    evidence_ids: planEvidence.map((e) => e.evidence_id),
    total_count: planEvidence.length,
    created_at: new Date().toISOString(),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(bundle.bundle_id, "plan_evidence_bundle_created"),
    trace_id: bundle.bundle_id,
    job_id: "planning",
    type: "plan_evidence_bundle_created",
    timestamp: bundle.created_at,
    payload: {
      bundle_id: bundle.bundle_id,
      plan_id,
      evidence_count: bundle.total_count,
    },
  });

  return bundle;
}
