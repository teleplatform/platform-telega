import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { updateRiskLedger } from "./plan-risk-ledger.js";
import { createVerificationMatrix } from "./plan-verification-matrix.js";

export interface LearningProposal {
  proposal_id: string;
  plan_id: string;
  lessons: string[];
  proposals: string[];
  created_at: string;
}

let learningCounter = 0;

export async function createLearningProposal(planId: string): Promise<LearningProposal> {
  learningCounter++;
  const risks = await updateRiskLedger(planId);
  const matrix = createVerificationMatrix(planId);

  const lessons: string[] = [];
  const proposals: string[] = [];

  if (!matrix.all_passed) {
    lessons.push(`Plan verification failed: ${matrix.checks.filter((c) => !c.passed).length}/${matrix.checks.length} checks failed`);
    proposals.push("Add pre-execution verification gate to ensure all checks pass before plan starts");
  }

  const criticalRisks = risks.filter((r) => r.severity === "critical" || r.severity === "high");
  if (criticalRisks.length > 0) {
    lessons.push(`${criticalRisks.length} critical/high risks detected during execution`);
    proposals.push("Add risk threshold gates that pause execution when critical risks exceed limit");
  }

  const blockerRisks = risks.filter((r) => r.category === "blocker");
  if (blockerRisks.length > 0) {
    lessons.push(`${blockerRisks.length} blockers encountered`);
    proposals.push("Create automated blocker resolution playbook");
  }

  const learning: LearningProposal = {
    proposal_id: `learning_${Date.now()}_${learningCounter}`,
    plan_id: planId,
    lessons,
    proposals,
    created_at: new Date().toISOString(),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(learning.proposal_id, "plan_learning_proposal_created"),
    trace_id: learning.proposal_id,
    job_id: "planning",
    type: "plan_learning_proposal_created",
    timestamp: learning.created_at,
    payload: {
      proposal_id: learning.proposal_id,
      plan_id: planId,
      lessons_count: lessons.length,
      proposals_count: proposals.length,
    },
  });

  return learning;
}
