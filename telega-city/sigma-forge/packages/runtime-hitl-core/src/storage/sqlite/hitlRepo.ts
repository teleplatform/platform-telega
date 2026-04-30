import type Database from "better-sqlite3";
import type {
  HandoffPacket,
  HumanDecision,
  ResumeContract,
  HitlAuditEvent,
} from "../../runtime-hitl-contracts/src/hitl.js";

export function createHitlRepos(db: Database.Database) {
  return {
    handoffs: {
      save(h: HandoffPacket): void {
        db.prepare(
          `INSERT OR REPLACE INTO hitl_handoffs (handoff_id, mission_id, run_id, action_id, department_id, handoff_type, reason_code, summary, requested_decision, options_json, recommended_option, paused_stage, paused_at, decision_ttl_at, status, created_at, updated_at)
           VALUES (@handoff_id, @mission_id, @run_id, @action_id, @department_id, @handoff_type, @reason_code, @summary, @requested_decision, @options_json, @recommended_option, @paused_stage, @paused_at, @decision_ttl_at, @status, @created_at, @updated_at)`
        ).run({
          ...h,
          run_id: h.run_id ?? null,
          action_id: h.action_id ?? null,
          department_id: h.department_id ?? null,
          options_json: h.options_json ?? null,
          recommended_option: h.recommended_option ?? null,
          decision_ttl_at: h.decision_ttl_at ?? null,
        });
      },
      getById(id: string): HandoffPacket | null {
        return db.prepare("SELECT * FROM hitl_handoffs WHERE handoff_id = ?").get(id) as HandoffPacket | null;
      },
      getByMission(mission_id: string): HandoffPacket[] {
        return db.prepare("SELECT * FROM hitl_handoffs WHERE mission_id = ? ORDER BY created_at DESC").all(mission_id) as HandoffPacket[];
      },
      getOpenHandoffs(): HandoffPacket[] {
        return db.prepare("SELECT * FROM hitl_handoffs WHERE status IN ('open', 'waiting') ORDER BY created_at").all() as HandoffPacket[];
      },
    },
    decisions: {
      save(d: HumanDecision): void {
        db.prepare(
          `INSERT INTO hitl_decisions (decision_id, handoff_id, mission_id, actor_id, decision, selected_option, input_payload_json, note, decided_at)
           VALUES (@decision_id, @handoff_id, @mission_id, @actor_id, @decision, @selected_option, @input_payload_json, @note, @decided_at)`
        ).run({
          ...d,
          selected_option: d.selected_option ?? null,
          input_payload_json: d.input_payload_json ?? null,
          note: d.note ?? null,
        });
      },
      getById(id: string): HumanDecision | null {
        return db.prepare("SELECT * FROM hitl_decisions WHERE decision_id = ?").get(id) as HumanDecision | null;
      },
      getByHandoffId(handoff_id: string): HumanDecision | null {
        return db.prepare("SELECT * FROM hitl_decisions WHERE handoff_id = ?").get(handoff_id) as HumanDecision | null;
      },
    },
    resume: {
      save(r: ResumeContract): void {
        db.prepare(
          `INSERT INTO hitl_resume_events (resume_id, handoff_id, mission_id, run_id, resume_mode, resume_payload_json, resumed_by, resumed_at, result_status, reason)
           VALUES (@resume_id, @handoff_id, @mission_id, @run_id, @resume_mode, @resume_payload_json, @resumed_by, @resumed_at, @result_status, @reason)`
        ).run({
          ...r,
          run_id: r.run_id ?? null,
          resume_payload_json: r.resume_payload_json ?? null,
          reason: r.reason ?? null,
        });
      },
    },
    audit: {
      append(e: HitlAuditEvent): void {
        db.prepare(
          `INSERT INTO hitl_audit (audit_id, handoff_id, mission_id, event_type, payload_json, timestamp)
           VALUES (@audit_id, @handoff_id, @mission_id, @event_type, @payload_json, @timestamp)`
        ).run({
          audit_id: e.audit_id,
          handoff_id: e.handoff_id ?? null,
          mission_id: e.mission_id ?? null,
          event_type: e.event_type,
          payload_json: JSON.stringify(e.payload),
          timestamp: e.timestamp,
        });
      },
      getTrail(mission_id: string): HitlAuditEvent[] {
        return db.prepare("SELECT * FROM hitl_audit WHERE mission_id = ? ORDER BY timestamp").all(mission_id) as HitlAuditEvent[];
      },
    },
  };
}

export type HitlRepos = ReturnType<typeof createHitlRepos>;
