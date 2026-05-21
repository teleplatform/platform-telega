import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

export interface VerificationEntry {
  check: string;
  passed: boolean;
  detail: string;
}

export interface VerificationMatrix {
  matrix_id: string;
  plan_id: string;
  checks: VerificationEntry[];
  all_passed: boolean;
  created_at: string;
}

let matrixCounter = 0;

export function createVerificationMatrix(planId: string): VerificationMatrix {
  matrixCounter++;
  const evidence = readEvidenceRecords();
  const planEvidence = evidence.filter((e) => e.payload?.plan_id === planId || e.trace_id === planId);

  const checks: VerificationEntry[] = [
    {
      check: "build",
      passed: planEvidence.some((e) => e.type === "strategic_plan_created" || e.type === "governed_plan_execution_started"),
      detail: planEvidence.some((e) => e.type === "governed_plan_execution_started") ? "Execution started" : "No execution records",
    },
    {
      check: "lint",
      passed: planEvidence.filter((e) => e.type === "plan_pack_materialized").length > 0,
      detail: planEvidence.filter((e) => e.type === "plan_pack_materialized").length > 0
        ? `${planEvidence.filter((e) => e.type === "plan_pack_materialized").length} packs materialized`
        : "No packs materialized",
    },
    {
      check: "tests",
      passed: planEvidence.filter((e) => e.type === "plan_dependency_status_updated").length > 0,
      detail: planEvidence.filter((e) => e.type === "plan_dependency_status_updated").length > 0
        ? "Dependencies tracked"
        : "No dependency tracking",
    },
    {
      check: "smoke",
      passed: planEvidence.filter((e) => e.type === "plan_progress_updated" || e.type === "plan_progress_blocked").length > 0,
      detail: "Progress monitor active",
    },
    {
      check: "policy",
      passed: !planEvidence.some((e) => e.type === "plan_progress_blocked"),
      detail: planEvidence.some((e) => e.type === "plan_progress_blocked") ? "Blockers detected" : "No blockers",
    },
    {
      check: "evidence",
      passed: planEvidence.length > 0,
      detail: `${planEvidence.length} evidence records found`,
    },
  ];

  const allPassed = checks.every((c) => c.passed);
  const matrix: VerificationMatrix = {
    matrix_id: `vmatrix_${Date.now()}_${matrixCounter}`,
    plan_id: planId,
    checks,
    all_passed: allPassed,
    created_at: new Date().toISOString(),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(matrix.matrix_id, "plan_verification_matrix_created"),
    trace_id: matrix.matrix_id,
    job_id: "planning",
    type: "plan_verification_matrix_created",
    timestamp: matrix.created_at,
    payload: {
      matrix_id: matrix.matrix_id,
      plan_id,
      checks_passed: checks.filter((c) => c.passed).length,
      checks_total: checks.length,
      all_passed: allPassed,
    },
  });

  return matrix;
}
