import type Database from "better-sqlite3";
import type { ComplianceDecision, ApprovalRequest, ComplianceAuditEvent } from "../../runtime-compliance-contracts/src/compliance.js";

function parseJsonList(row: any, field: string): string[] {
  try { return JSON.parse(row[field] || "[]"); } catch { return []; }
}
function parseJsonMap(row: any, field: string): Record<string, unknown> {
  try { return JSON.parse(row[field] || "{}"); } catch { return {}; }
}

export function createComplianceRepos(db: Database.Database) {
  return {
    decisions: {
      save(d: ComplianceDecision): void {
        db.prepare(
          `INSERT OR REPLACE INTO compliance_decisions (decision_id, action_id, mission_id, run_id, verdict, severity, requires_human_approval, approval_reason, policy_refs_json, reason_codes_json, explanation, decided_at)
           VALUES (@decision_id, @action_id, @mission_id, @run_id, @verdict, @severity, @requires_human_approval, @approval_reason, @policy_refs_json, @reason_codes_json, @explanation, @decided_at)`
        ).run({
          ...d,
          policy_refs_json: JSON.stringify(d.policy_refs),
          reason_codes_json: JSON.stringify(d.reason_codes),
          requires_human_approval: d.requires_human_approval ? 1 : 0,
          mission_id: d.mission_id ?? null,
          run_id: (d as any).run_id ?? null,
          approval_reason: d.approval_reason ?? null,
        });
      },
      getById(id: string): ComplianceDecision | null {
        const row = db.prepare("SELECT * FROM compliance_decisions WHERE decision_id = ?").get(id) as any;
        return row ? {
          ...row,
          requires_human_approval: !!row.requires_human_approval,
          policy_refs: parseJsonList(row, "policy_refs_json"),
          reason_codes: parseJsonList(row, "reason_codes_json"),
        } : null;
      },
      getByActionId(action_id: string): ComplianceDecision | null {
        const row = db.prepare("SELECT * FROM compliance_decisions WHERE action_id = ? ORDER BY decided_at DESC LIMIT 1").get(action_id) as any;
        return row ? {
          ...row,
          requires_human_approval: !!row.requires_human_approval,
          policy_refs: parseJsonList(row, "policy_refs_json"),
          reason_codes: parseJsonList(row, "reason_codes_json"),
        } : null;
      },
    },
    approvals: {
      save(a: ApprovalRequest): void {
        db.prepare(
          `INSERT INTO approval_requests (request_id, action_id, mission_id, required_decision, recommended_option, status, opened_at, resolved_at, resolved_by, decision_value)
           VALUES (@request_id, @action_id, @mission_id, @required_decision, @recommended_option, @status, @opened_at, @resolved_at, @resolved_by, @decision_value)`
        ).run({
          ...a,
          mission_id: a.mission_id ?? null,
          recommended_option: a.recommended_option ?? null,
          resolved_at: a.resolved_at ?? null,
          resolved_by: a.resolved_by ?? null,
          decision_value: a.decision_value ?? null,
        });
      },
    },
    audit: {
      append(e: ComplianceAuditEvent): void {
        db.prepare(
          `INSERT INTO compliance_events (audit_id, action_id, mission_id, event_type, actor_id, details_json, timestamp)
           VALUES (@audit_id, @action_id, @mission_id, @event_type, @actor_id, @details_json, @timestamp)`
        ).run({
          audit_id: e.audit_id,
          action_id: e.action_id,
          mission_id: e.mission_id ?? null,
          event_type: e.event_type,
          actor_id: e.actor_id,
          details_json: JSON.stringify(e.details),
          timestamp: e.timestamp,
        });
      },
    },
  };
}

export type ComplianceRepos = ReturnType<typeof createComplianceRepos>;
