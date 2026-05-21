import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { getCanon, type CanonEntry } from "./strategic-canon-registry.js";
import { checkEvolutionProposalGovernance } from "../hooks/evolution-proposal-governance-hook.js";

export interface PromotionCheck {
  canon_id: string;
  has_evidence: boolean;
  has_provenance: boolean;
  has_approval: boolean;
  is_fresh: boolean;
  all_passed: boolean;
}

export async function checkCanonPromotion(canonId: string): Promise<PromotionCheck> {
  const entry = getCanon(canonId);
  if (!entry) throw new Error(`Canon ${canonId} not found`);

  const gate = await checkEvolutionProposalGovernance({
    kind: "canon_promotion",
    proposal_id: canonId,
    requested_by: "system",
    risk_hint: "high",
  });
  if (gate.decision !== "allowed") {
    const blocked: PromotionCheck = {
      canon_id: canonId,
      has_evidence: false,
      has_provenance: false,
      has_approval: false,
      is_fresh: false,
      all_passed: false,
    };
    await appendEvidenceRecord({
      evidence_id: hashTraceId(`${canonId}_promo_governance`, "canon_promotion_blocked"),
      trace_id: canonId,
      job_id: "knowledge",
      type: "canon_promotion_blocked",
      timestamp: new Date().toISOString(),
      payload: { canon_id: canonId, blocked_by: ["evolution_governance"], reason: gate.reason, approval_id: gate.approval_id },
    });
    return blocked;
  }

  const evidence = readEvidenceRecords();

  const hasEvidence = entry.evidence_refs.length > 0 &&
    entry.evidence_refs.some((ref) => evidence.some((e) => e.evidence_id === ref));

  const hasProvenance = hasEvidence;

  const hasApproval = evidence.some((e) =>
    e.type === "self_correction_approval_approved" &&
    e.payload?.proposal_id === canonId,
  );

  const age = Date.now() - new Date(entry.created_at).getTime();
  const isFresh = age < 30 * 24 * 60 * 60 * 1000;

  const check: PromotionCheck = {
    canon_id: canonId,
    has_evidence: hasEvidence,
    has_provenance: hasProvenance,
    has_approval: hasApproval,
    is_fresh: isFresh,
    all_passed: hasEvidence && hasProvenance && hasApproval && isFresh,
  };

  if (!check.all_passed) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(`${canonId}_promo`, "canon_promotion_blocked"),
      trace_id: canonId,
      job_id: "knowledge",
      type: "canon_promotion_blocked",
      timestamp: new Date().toISOString(),
      payload: {
        canon_id: canonId,
        blocked_by: Object.entries(check)
          .filter(([k, v]) => k !== "canon_id" && k !== "all_passed" && !v)
          .map(([k]) => k),
      },
    });
  } else {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(`${canonId}_promo`, "canon_promotion_checked"),
      trace_id: canonId,
      job_id: "knowledge",
      type: "canon_promotion_checked",
      timestamp: new Date().toISOString(),
      payload: { canon_id: canonId, all_passed: true },
    });
  }

  return check;
}

export async function promoteToActive(canonId: string): Promise<CanonEntry | null> {
  const check = await checkCanonPromotion(canonId);
  if (!check.all_passed) return null;

  const entry = getCanon(canonId);
  if (!entry) return null;

  entry.status = "active";
  entry.updated_at = new Date().toISOString();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${canonId}_promoted`, "canon_promoted"),
    trace_id: canonId,
    job_id: "knowledge",
    type: "canon_promoted",
    timestamp: entry.updated_at,
    payload: { canon_id: canonId, category: entry.category },
  });

  return entry;
}
