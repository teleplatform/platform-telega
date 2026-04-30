import type { ComplianceDecision, ComplianceAuditEntry } from "../../runtime-safety-contracts/src/compliance.js";
import { runComplianceGateway } from "../compliance/complianceGateway.js";
import { createComplianceAuditRepo } from "../storage/sqlite/complianceAuditRepo.js";
import type Database from "better-sqlite3";

export interface ComplianceResult {
  decision: ComplianceDecision;
  sanitized_payload?: unknown;
  audit: ComplianceAuditEntry;
}

export function checkRuntimeCompliance(payload: unknown, context: { target?: "provider" | "tool" | "channel" | "storage"; tele_user_id?: string; task_id?: string; session_id?: string }, db: Database.Database): ComplianceResult {
  const result = runComplianceGateway(payload, context);
  const auditRepo = createComplianceAuditRepo(db);
  auditRepo.saveAudit(result.audit);
  return result;
}
