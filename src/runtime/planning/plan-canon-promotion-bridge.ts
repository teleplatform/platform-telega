import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActiveCanons } from "../knowledge/strategic-canon-registry.js";
import { getPlan } from "./strategic-planning-engine.js";

export interface CanonPromotionCandidate {
  candidate_id: string;
  plan_id: string;
  title: string;
  description: string;
  category: string;
  evidence_refs: string[];
  created_at: string;
}

let candidateCounter = 0;

export async function createCanonPromotionCandidate(planId: string): Promise<CanonPromotionCandidate | null> {
  candidateCounter++;
  const plan = getPlan(planId);
  if (!plan) return null;

  const activeCanons = getActiveCanons();

  const candidate: CanonPromotionCandidate = {
    candidate_id: `canon_candidate_${Date.now()}_${candidateCounter}`,
    plan_id: planId,
    title: `Lesson from plan: ${plan.title}`,
    description: `Plan ${plan.title} completed with status ${plan.status}. Consider canonizing lessons learned for future runtime evolution.`,
    category: "governance",
    evidence_refs: activeCanons.slice(0, 3).map((c) => c.canon_id),
    created_at: new Date().toISOString(),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(candidate.candidate_id, "plan_canon_promotion_candidate_created"),
    trace_id: candidate.candidate_id,
    job_id: "planning",
    type: "plan_canon_promotion_candidate_created",
    timestamp: candidate.created_at,
    payload: {
      candidate_id: candidate.candidate_id,
      plan_id: planId,
      plan_title: plan.title,
      category: candidate.category,
    },
  });

  return candidate;
}
