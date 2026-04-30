import type Database from "better-sqlite3";
import type {
  ControlSurface,
  HumanGovernanceAction,
  LegibilityDigest,
  TruthViewDescriptor,
  GuardedWriteActionPolicy,
  DecisionDigest,
  OperatorInterventionRequest,
  ControlAuditEvent,
} from "../../runtime-control-contracts/src/control.js";

function parseJsonList(row: any, field: string): string[] {
  try { return JSON.parse(row[field] || "[]"); } catch { return []; }
}
function parseJsonMap(row: any, field: string): Record<string, unknown> {
  try { return JSON.parse(row[field] || "{}"); } catch { return {}; }
}

export function createControlRepos(db: Database.Database) {
  return {
    surfaces: {
      save(s: ControlSurface): void {
        db.prepare(
          `INSERT OR REPLACE INTO control_surfaces (surface_id, surface_type, title, allowed_views_json, allowed_actions_json, required_role_map_json, status, created_at)
           VALUES (@surface_id, @surface_type, @title, @allowed_views_json, @allowed_actions_json, @required_role_map_json, @status, @created_at)`
        ).run({ ...s, allowed_views_json: JSON.stringify(s.allowed_views), allowed_actions_json: JSON.stringify(s.allowed_actions), required_role_map_json: JSON.stringify(s.required_role_map) });
      },
      getById(id: string): ControlSurface | null {
        const row = db.prepare("SELECT * FROM control_surfaces WHERE surface_id = ?").get(id) as any;
        return row ? { ...row, allowed_views: parseJsonList(row, "allowed_views_json"), allowed_actions: parseJsonList(row, "allowed_actions_json"), required_role_map: parseJsonMap(row, "required_role_map_json") } : null;
      },
    },
    actions: {
      save(a: HumanGovernanceAction): void {
        db.prepare(
          `INSERT INTO human_governance_actions (action_id, action_type, target_type, target_id, actor_id, actor_role, mode, risk_class, created_at)
           VALUES (@action_id, @action_type, @target_type, @target_id, @actor_id, @actor_role, @mode, @risk_class, @created_at)`
        ).run(a);
      },
    },
    digests: {
      save(d: LegibilityDigest): void {
        db.prepare(
          `INSERT INTO legibility_digests (digest_id, target_type, target_id, summary, evidence_refs_json, active_constraints_json, pending_actions_json, risk_flags_json, generated_at)
           VALUES (@digest_id, @target_type, @target_id, @summary, @evidence_refs_json, @active_constraints_json, @pending_actions_json, @risk_flags_json, @generated_at)`
        ).run({ ...d, evidence_refs_json: JSON.stringify(d.evidence_refs), active_constraints_json: JSON.stringify(d.active_constraints), pending_actions_json: JSON.stringify(d.pending_actions), risk_flags_json: JSON.stringify(d.risk_flags) });
      },
      getById(id: string): LegibilityDigest | null {
        const row = db.prepare("SELECT * FROM legibility_digests WHERE digest_id = ?").get(id) as any;
        return row ? { ...row, evidence_refs: parseJsonList(row, "evidence_refs_json"), active_constraints: parseJsonList(row, "active_constraints_json"), pending_actions: parseJsonList(row, "pending_actions_json"), risk_flags: parseJsonList(row, "risk_flags_json") } : null;
      },
    },
    truthViews: {
      save(v: TruthViewDescriptor): void {
        db.prepare(
          `INSERT INTO truth_views (view_id, view_type, scope_type, scope_id, state_summary, provenance_refs_json, active_constraints_json, recent_decisions_json, generated_at)
           VALUES (@view_id, @view_type, @scope_type, @scope_id, @state_summary, @provenance_refs_json, @active_constraints_json, @recent_decisions_json, @generated_at)`
        ).run({ ...v, provenance_refs_json: JSON.stringify(v.provenance_refs), active_constraints_json: JSON.stringify(v.active_constraints), recent_decisions_json: JSON.stringify(v.recent_decisions) });
      },
      getById(id: string): TruthViewDescriptor | null {
        const row = db.prepare("SELECT * FROM truth_views WHERE view_id = ?").get(id) as any;
        return row ? { ...row, provenance_refs: parseJsonList(row, "provenance_refs_json"), active_constraints: parseJsonList(row, "active_constraints_json"), recent_decisions: parseJsonList(row, "recent_decisions_json") } : null;
      },
    },
    guardedPolicies: {
      save(p: GuardedWriteActionPolicy): void {
        db.prepare(
          `INSERT OR REPLACE INTO guarded_action_policies (policy_id, action_type, required_roles_json, confirmation_mode, blocked_if_constraints_json)
           VALUES (@policy_id, @action_type, @required_roles_json, @confirmation_mode, @blocked_if_constraints_json)`
        ).run({ ...p, required_roles_json: JSON.stringify(p.required_roles), blocked_if_constraints_json: JSON.stringify(p.blocked_if_constraints) });
      },
      getByAction(action_type: string): GuardedWriteActionPolicy | null {
        const row = db.prepare("SELECT * FROM guarded_action_policies WHERE action_type = ?").get(action_type) as any;
        return row ? { ...row, required_roles: parseJsonList(row, "required_roles_json"), blocked_if_constraints: parseJsonList(row, "blocked_if_constraints_json") } : null;
      },
    },
    decisionDigests: {
      save(d: DecisionDigest): void {
        db.prepare(
          `INSERT INTO decision_digests (digest_id, digest_type, scope_type, scope_id, title, summary, what_changed_json, what_blocked_json, next_actions_json, what_not_to_touch_json, trace_refs_json, generated_at)
           VALUES (@digest_id, @digest_type, @scope_type, @scope_id, @title, @summary, @what_changed_json, @what_blocked_json, @next_actions_json, @what_not_to_touch_json, @trace_refs_json, @generated_at)`
        ).run({ ...d, what_changed_json: JSON.stringify(d.what_changed), what_blocked_json: JSON.stringify(d.what_blocked), next_actions_json: JSON.stringify(d.next_actions), what_not_to_touch_json: JSON.stringify(d.what_not_to_touch), trace_refs_json: JSON.stringify(d.trace_refs) });
      },
    },
    interventions: {
      save(i: OperatorInterventionRequest): void {
        db.prepare(
          `INSERT INTO operator_interventions (intervention_id, action_type, target_type, target_id, actor_id, reason, risk_class, status, created_at)
           VALUES (@intervention_id, @action_type, @target_type, @target_id, @actor_id, @reason, @risk_class, @status, @created_at)`
        ).run(i);
      },
    },
    audit: {
      append(e: ControlAuditEvent): void {
        db.prepare(
          `INSERT INTO control_audit (audit_id, event_type, actor_id, actor_role, target_type, target_id, details_json, timestamp)
           VALUES (@audit_id, @event_type, @actor_id, @actor_role, @target_type, @target_id, @details_json, @timestamp)`
        ).run({
          audit_id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          event_type: e.event_type,
          actor_id: e.actor_id,
          actor_role: e.actor_role,
          target_type: e.target_type ?? null,
          target_id: e.target_id ?? null,
          details_json: JSON.stringify(e.details),
          timestamp: e.timestamp,
        });
      },
      getTrail(actor_id?: string): ControlAuditEvent[] {
        if (actor_id) {
          return db.prepare("SELECT * FROM control_audit WHERE actor_id = ? ORDER BY timestamp").all(actor_id) as ControlAuditEvent[];
        }
        return db.prepare("SELECT * FROM control_audit ORDER BY timestamp").all() as ControlAuditEvent[];
      },
    },
  };
}

export type ControlRepos = ReturnType<typeof createControlRepos>;
