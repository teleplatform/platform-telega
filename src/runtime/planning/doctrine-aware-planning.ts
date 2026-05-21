import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getConstitutionState } from "../constitution/runtime-constitution.js";
import { getAllDoctrines } from "../knowledge/runtime-doctrine-registry.js";

export interface DoctrineAwareCheck {
  check_id: string;
  plan_id: string;
  constitution_compliant: boolean;
  doctrine_compliant: boolean;
  ethics_compliant: boolean;
  sovereignty_compliant: boolean;
  blocked: boolean;
  reason?: string;
  checked_at: string;
}

let checkCounter = 0;

export async function checkPlanAgainstDoctrines(planId: string, planDescription: string): Promise<DoctrineAwareCheck> {
  checkCounter++;
  const constitution = getConstitutionState();
  const doctrines = getAllDoctrines();

  const constitutionCompliant = !constitution.emergency_freeze_active;
  const sovereigntyCompliant = !constitution.sovereignty_frozen;

  let doctrineCompliant = true;
  let ethicsCompliant = true;
  let reason: string | undefined;

  for (const d of doctrines) {
    if (d.immutable && d.title === "No Silent Mutation" && planDescription.toLowerCase().includes("silent")) {
      doctrineCompliant = false;
      reason = `Violates doctrine: ${d.title}`;
    }
    if (d.category === "ethics" && !ethicsCompliant) {
      ethicsCompliant = false;
      reason = `Violates doctrine: ${d.title}`;
    }
  }

  const blocked = !constitutionCompliant || !doctrineCompliant || !ethicsCompliant || !sovereigntyCompliant;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`dap_${checkCounter}`, blocked ? "doctrine_aware_plan_blocked" : "doctrine_aware_plan_checked"),
    trace_id: `dap_${checkCounter}`,
    job_id: "planning",
    type: blocked ? "doctrine_aware_plan_blocked" : "doctrine_aware_plan_checked",
    timestamp: new Date().toISOString(),
    payload: {
      check_id: `dap_${checkCounter}`,
      plan_id: planId,
      blocked,
      constitution_compliant: constitutionCompliant,
      doctrine_compliant: doctrineCompliant,
      ethics_compliant: ethicsCompliant,
      sovereignty_compliant: sovereigntyCompliant,
      reason,
    },
  });

  return {
    check_id: `dap_${checkCounter}`,
    plan_id: planId,
    constitution_compliant: constitutionCompliant,
    doctrine_compliant: doctrineCompliant,
    ethics_compliant: ethicsCompliant,
    sovereignty_compliant: sovereigntyCompliant,
    blocked,
    reason,
    checked_at: new Date().toISOString(),
  };
}
