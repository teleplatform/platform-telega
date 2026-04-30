import type Database from "better-sqlite3";
import type { HumanHandoffPacket } from "../../runtime-task-contracts/src/handoff.js";

export function createHandoffsRepo(db: Database.Database) {
  return {
    saveHandoff(packet: HumanHandoffPacket): void {
      db.prepare(
        `INSERT INTO runtime_handoffs (handoff_id, task_id, run_id, summary, completed_steps_json, blocked_reason, recommended_action, draft_output, required_human_input_json, risk_flags_json, rejected_options_json, reason_code, created_at)
         VALUES (@handoff_id, @task_id, @run_id, @summary, @completed_steps_json, @blocked_reason, @recommended_action, @draft_output, @required_human_input_json, @risk_flags_json, @rejected_options_json, @reason_code, @created_at)`
      ).run({
        handoff_id: packet.handoff_id,
        task_id: packet.task_id,
        run_id: packet.run_id ?? null,
        summary: packet.summary,
        completed_steps_json: JSON.stringify(packet.completed_steps),
        blocked_reason: packet.blocked_reason ?? null,
        recommended_action: packet.recommended_action ?? null,
        draft_output: packet.draft_output ?? null,
        required_human_input_json: JSON.stringify(packet.required_human_input ?? []),
        risk_flags_json: JSON.stringify(packet.risk_flags ?? []),
        rejected_options_json: JSON.stringify(packet.rejected_options ?? []),
        reason_code: packet.reason_code,
        created_at: packet.created_at,
      });
    },
    getHandoff(handoff_id: string): HumanHandoffPacket | null {
      const row = db.prepare("SELECT * FROM runtime_handoffs WHERE handoff_id = ?").get(handoff_id);
      if (!row) return null;
      const r = row as any;
      return { ...r, completed_steps: JSON.parse(r.completed_steps_json || "[]"), required_human_input: JSON.parse(r.required_human_input_json || "[]"), risk_flags: JSON.parse(r.risk_flags_json || "[]"), rejected_options: JSON.parse(r.rejected_options_json || "[]") };
    },
    listHandoffsByTask(task_id: string): HumanHandoffPacket[] {
      const rows = db.prepare("SELECT * FROM runtime_handoffs WHERE task_id = ? ORDER BY created_at DESC").all(task_id);
      return rows.map((r: any) => ({ ...r, completed_steps: JSON.parse(r.completed_steps_json || "[]"), required_human_input: JSON.parse(r.required_human_input_json || "[]"), risk_flags: JSON.parse(r.risk_flags_json || "[]"), rejected_options: JSON.parse(r.rejected_options_json || "[]") }));
    },
  };
}

export function createDecisionsRepo(db: Database.Database) {
  return {
    saveDecision(decision: any): void {
      db.prepare(
        `INSERT INTO runtime_human_decisions (decision_id, handoff_id, task_id, action, editor_notes, replacement_output, reroute_target, created_at)
         VALUES (@decision_id, @handoff_id, @task_id, @action, @editor_notes, @replacement_output, @reroute_target, @created_at)`
      ).run({
        decision_id: decision.decision_id,
        handoff_id: decision.handoff_id,
        task_id: decision.task_id,
        action: decision.action,
        editor_notes: decision.editor_notes ?? null,
        replacement_output: decision.replacement_output ?? null,
        reroute_target: decision.reroute_target ?? null,
        created_at: decision.created_at,
      });
    },
    getDecision(decision_id: string): any {
      return db.prepare("SELECT * FROM runtime_human_decisions WHERE decision_id = ?").get(decision_id);
    },
    listDecisionsByTask(task_id: string): any[] {
      return db.prepare("SELECT * FROM runtime_human_decisions WHERE task_id = ? ORDER BY created_at DESC").all(task_id);
    },
  };
}

export function createDeliveriesRepo(db: Database.Database) {
  return {
    saveDelivery(envelope: any): void {
      db.prepare(
        `INSERT INTO runtime_task_deliveries (delivery_id, task_id, tele_user_id, target, status, payload_summary, payload_ref, created_at)
         VALUES (@delivery_id, @task_id, @tele_user_id, @target, @status, @payload_summary, @payload_ref, @created_at)`
      ).run({
        delivery_id: envelope.delivery_id,
        task_id: envelope.task_id,
        tele_user_id: envelope.tele_user_id,
        target: envelope.target,
        status: envelope.status,
        payload_summary: envelope.payload_summary,
        payload_ref: envelope.payload_ref ?? null,
        created_at: envelope.created_at,
      });
    },
    listDeliveriesByTask(task_id: string): any[] {
      return db.prepare("SELECT * FROM runtime_task_deliveries WHERE task_id = ? ORDER BY created_at DESC").all(task_id);
    },
    updateDelivery(delivery_id: string, patch: any): void {
      const fields: string[] = [];
      const params: any = { delivery_id };
      for (const [key, value] of Object.entries(patch)) {
        if (key === "delivery_id") continue;
        fields.push(`${key} = @${key}`);
        params[key] = value;
      }
      if (fields.length === 0) return;
      db.prepare(`UPDATE runtime_task_deliveries SET ${fields.join(", ")} WHERE delivery_id = @delivery_id`).run(params);
    },
  };
}
