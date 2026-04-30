import type Database from "better-sqlite3";
import type { ComplianceDecision, RedactionEntry, SensitivityLevel } from "../../runtime-safety-contracts/src/compliance.js";

export interface ComplianceAuditEntry {
  audit_id: string;
  task_id?: string;
  session_id?: string;
  tele_user_id?: string;
  sensitivity: SensitivityLevel;
  allowed: boolean;
  blocked_reasons: string[];
  redactions: RedactionEntry[];
  outbound_policy: ComplianceDecision["outbound_policy"];
  created_at: string;
}

export function createComplianceAuditRepo(db: Database.Database) {
  return {
    saveAudit(entry: ComplianceAuditEntry): void {
      db.prepare(
        `INSERT INTO runtime_compliance_audit (audit_id, task_id, session_id, tele_user_id, sensitivity, allowed, blocked_reasons_json, redactions_json, outbound_policy_json, created_at)
         VALUES (@audit_id, @task_id, @session_id, @tele_user_id, @sensitivity, @allowed, @blocked_reasons_json, @redactions_json, @outbound_policy_json, @created_at)`
      ).run({
        audit_id: entry.audit_id,
        task_id: entry.task_id ?? null,
        session_id: entry.session_id ?? null,
        tele_user_id: entry.tele_user_id ?? null,
        sensitivity: entry.sensitivity,
        allowed: entry.allowed ? 1 : 0,
        blocked_reasons_json: JSON.stringify(entry.blocked_reasons),
        redactions_json: JSON.stringify(entry.redactions),
        outbound_policy_json: JSON.stringify(entry.outbound_policy),
        created_at: entry.created_at,
      });
    },

    getAuditsByTask(task_id: string): ComplianceAuditEntry[] {
      const rows = db.prepare("SELECT * FROM runtime_compliance_audit WHERE task_id = ? ORDER BY created_at DESC").all(task_id);
      return rows.map((r: any) => ({
        ...r,
        blocked_reasons: JSON.parse(r.blocked_reasons_json || "[]"),
        redactions: JSON.parse(r.redactions_json || "[]"),
        outbound_policy: JSON.parse(r.outbound_policy_json || "{}"),
        allowed: !!r.allowed,
      }));
    },

    getLatestAudit(tele_user_id: string): ComplianceAuditEntry | null {
      const row = db.prepare("SELECT * FROM runtime_compliance_audit WHERE tele_user_id = ? ORDER BY created_at DESC LIMIT 1").get(tele_user_id);
      if (!row) return null;
      return {
        ...(row as any),
        blocked_reasons: JSON.parse((row as any).blocked_reasons_json || "[]"),
        redactions: JSON.parse((row as any).redactions_json || "[]"),
        outbound_policy: JSON.parse((row as any).outbound_policy_json || "{}"),
        allowed: !!(row as any).allowed,
      };
    },
  };
}
