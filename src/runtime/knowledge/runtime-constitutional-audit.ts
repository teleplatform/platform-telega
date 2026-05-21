import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getConstitutionState } from "../constitution/runtime-constitution.js";
import { getAllDoctrines } from "./runtime-doctrine-registry.js";
import { getActiveCanons } from "./strategic-canon-registry.js";
import { detectCanonConflicts } from "./canon-conflict-detector.js";

export interface ConstitutionalAuditResult {
  audit_id: string;
  started_at: string;
  completed_at: string;
  constitution_ok: boolean;
  doctrines_ok: boolean;
  policies_ok: boolean;
  sovereignty_ok: boolean;
  approvals_ok: boolean;
  ethics_ok: boolean;
  all_passed: boolean;
  issues: string[];
}

let auditCounter = 0;

export async function runConstitutionalAudit(): Promise<ConstitutionalAuditResult> {
  auditCounter++;
  const auditId = `audit_${Date.now()}_${auditCounter}`;
  const startTime = new Date().toISOString();
  const issues: string[] = [];

  await appendEvidenceRecord({
    evidence_id: hashTraceId(auditId, "constitutional_audit_started"),
    trace_id: auditId,
    job_id: "knowledge",
    type: "constitutional_audit_started",
    timestamp: startTime,
    payload: { audit_id: auditId },
  });

  const constitution = getConstitutionState();
  const constitutionOk = constitution.rules_active.length > 0 && !constitution.emergency_freeze_active;
  if (!constitutionOk) {
    issues.push(constitution.emergency_freeze_active
      ? "Emergency freeze is active — constitution overridden"
      : "No active constitution rules");
  }

  const doctrines = getAllDoctrines();
  const doctrinesOk = doctrines.length >= 5;
  if (!doctrinesOk) {
    issues.push(`Only ${doctrines.length} doctrines registered (minimum 5 recommended)`);
  }

  const canons = getActiveCanons();
  let policiesOk = true;
  for (const c of canons) {
    const conflicts = detectCanonConflicts(c);
    if (conflicts.length > 0) {
      policiesOk = false;
      issues.push(`Canon conflict: ${c.title} — ${conflicts.length} conflict(s)`);
    }
  }

  const sovState = constitution;
  const sovereigntyOk = !sovState.sovereignty_frozen;
  if (!sovereigntyOk) {
    issues.push("Sovereignty is frozen");
  }

  const approvalsOk = constitution.violations.filter((v) => v.severity === "critical" || v.severity === "civilization_risk").length === 0;
  if (!approvalsOk) {
    issues.push(`Pending critical violations: ${constitution.violations.filter((v) => v.severity === "critical" || v.severity === "civilization_risk").length}`);
  }

  const ethicsOk = true;

  const result: ConstitutionalAuditResult = {
    audit_id: auditId,
    started_at: startTime,
    completed_at: new Date().toISOString(),
    constitution_ok: constitutionOk,
    doctrines_ok: doctrinesOk,
    policies_ok,
    sovereignty_ok: sovereigntyOk,
    approvals_ok,
    ethics_ok,
    all_passed: constitutionOk && doctrinesOk && policiesOk && sovereigntyOk && approvalsOk && ethicsOk,
    issues,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(auditId, "constitutional_audit_completed"),
    trace_id: auditId,
    job_id: "knowledge",
    type: "constitutional_audit_completed",
    timestamp: result.completed_at,
    payload: {
      audit_id: auditId,
      all_passed: result.all_passed,
      issues_count: issues.length,
      issues,
    },
  });

  return result;
}
