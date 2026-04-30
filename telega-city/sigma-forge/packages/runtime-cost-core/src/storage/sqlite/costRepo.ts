import type Database from "better-sqlite3";
import type {
  MissionCostProfile,
  BranchCostEstimate,
  CostDecision,
} from "../../runtime-cost-contracts/src/cost.js";

function parseJsonList(row: any, field: string): string[] {
  try { return JSON.parse(row[field] || "[]"); } catch { return []; }
}

export function createCostRepos(db: Database.Database) {
  return {
    profiles: {
      save(p: MissionCostProfile): void {
        db.prepare(
          `INSERT OR REPLACE INTO cost_profiles (profile_id, mission_type, department_id, max_auto_cost_usd, confirmation_cost_usd, hard_cap_cost_usd, max_orchestration_depth, require_confirmation_if_user_visible, default_business_value, created_at, updated_at)
           VALUES (@profile_id, @mission_type, @department_id, @max_auto_cost_usd, @confirmation_cost_usd, @hard_cap_cost_usd, @max_orchestration_depth, @require_confirmation_if_user_visible, @default_business_value, @created_at, @updated_at)`
        ).run({
          ...p,
          department_id: p.department_id ?? null,
          require_confirmation_if_user_visible: p.require_confirmation_if_user_visible ? 1 : 0,
        });
      },
      getById(id: string): MissionCostProfile | null {
        const row = db.prepare("SELECT * FROM cost_profiles WHERE profile_id = ?").get(id) as any;
        return row ? { ...row, require_confirmation_if_user_visible: !!row.require_confirmation_if_user_visible } : null;
      },
      getByMissionType(mission_type: string, department_id?: string | null): MissionCostProfile | null {
        const row = db.prepare("SELECT * FROM cost_profiles WHERE mission_type = ? AND (department_id = ? OR department_id IS NULL) ORDER BY department_id DESC NULLS LAST LIMIT 1").get(mission_type, department_id ?? null) as any;
        return row ? { ...row, require_confirmation_if_user_visible: !!row.require_confirmation_if_user_visible } : null;
      },
    },
    estimates: {
      save(e: BranchCostEstimate): void {
        db.prepare(
          `INSERT INTO branch_cost_estimates (estimate_id, mission_id, run_id, route_key, estimated_cost_usd, estimated_tokens_in, estimated_tokens_out, estimated_tool_calls, orchestration_depth, estimated_latency_ms, created_at)
           VALUES (@estimate_id, @mission_id, @run_id, @route_key, @estimated_cost_usd, @estimated_tokens_in, @estimated_tokens_out, @estimated_tool_calls, @orchestration_depth, @estimated_latency_ms, @created_at)`
        ).run({
          ...e,
          run_id: e.run_id ?? null,
          route_key: e.route_key ?? null,
          estimated_tokens_in: e.estimated_tokens_in ?? null,
          estimated_tokens_out: e.estimated_tokens_out ?? null,
          estimated_tool_calls: e.estimated_tool_calls ?? null,
          estimated_latency_ms: e.estimated_latency_ms ?? null,
        });
      },
    },
    decisions: {
      save(d: CostDecision & { mission_id: string; run_id?: string | null; cost_eval_id: string }): void {
        db.prepare(
          `INSERT INTO cost_decisions (decision_id, cost_eval_id, mission_id, run_id, verdict, severity, reason_codes_json, policy_refs_json, estimated_cost_usd, approved_cost_threshold_usd, explanation, created_at)
           VALUES (@decision_id, @cost_eval_id, @mission_id, @run_id, @verdict, @severity, @reason_codes_json, @policy_refs_json, @estimated_cost_usd, @approved_cost_threshold_usd, @explanation, @created_at)`
        ).run({
          decision_id: d.decision_id,
          cost_eval_id: d.cost_eval_id,
          mission_id: d.mission_id,
          run_id: d.run_id ?? null,
          verdict: d.verdict,
          severity: d.severity,
          reason_codes_json: JSON.stringify(d.reason_codes),
          policy_refs_json: JSON.stringify(d.policy_refs),
          estimated_cost_usd: d.estimated_cost_usd,
          approved_cost_threshold_usd: d.approved_cost_threshold_usd ?? null,
          explanation: d.explanation,
          created_at: d.decided_at ?? new Date().toISOString(),
        });
      },
    },
    audit: {
      append(e: { audit_id: string; mission_id: string; run_id?: string; event_type: string; payload_json: string; created_at: string }): void {
        db.prepare(
          `INSERT INTO cost_audit (audit_id, mission_id, run_id, event_type, payload_json, created_at)
           VALUES (@audit_id, @mission_id, @run_id, @event_type, @payload_json, @created_at)`
        ).run({
          ...e,
          run_id: e.run_id ?? null,
        });
      },
    },
  };
}

export type CostRepos = ReturnType<typeof createCostRepos>;
