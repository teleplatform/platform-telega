import type Database from "better-sqlite3";
import type { RunLedger } from "../../../fsgr-contracts/src/index.js";

export function createRunsRepo(db: Database.Database) {
  return {
    createRun(run: RunLedger): void {
      db.prepare(
        `INSERT INTO fsgr_runs (run_id, task_id, actor_id, actor_mode, status, graph_id, plan_mode, trace_id, resume_token, created_at, updated_at)
         VALUES (@run_id, @task_id, @actor_id, @actor_mode, @status, @graph_id, @plan_mode, @trace_id, @resume_token, @created_at, @updated_at)`
      ).run({
        run_id: run.run_id,
        task_id: run.task_id,
        actor_id: run.actor_id,
        actor_mode: run.actor_mode,
        status: run.status,
        graph_id: run.graph_id,
        plan_mode: run.plan_mode,
        trace_id: run.trace_id ?? null,
        resume_token: run.resume_token ?? null,
        created_at: run.created_at,
        updated_at: run.updated_at,
      });
    },

    getRunById(run_id: string): RunLedger | null {
      const row = db.prepare("SELECT * FROM fsgr_runs WHERE run_id = ?").get(run_id) as any;
      if (!row) return null;
      return {
        run_id: row.run_id,
        task_id: row.task_id,
        actor_id: row.actor_id,
        actor_mode: row.actor_mode,
        status: row.status,
        graph_id: row.graph_id,
        plan_mode: row.plan_mode,
        selected_skill_ids: [],
        current_node_ids: [],
        completed_node_ids: [],
        failed_node_ids: [],
        artifact_ids: [],
        trace_id: row.trace_id,
        resume_token: row.resume_token,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    },

    updateRun(run_id: string, patch: Partial<RunLedger>): void {
      const fields: string[] = [];
      const params: Record<string, any> = { run_id };
      for (const [key, value] of Object.entries(patch)) {
        if (key === "run_id") continue;
        fields.push(`${key} = @${key}`);
        params[key] = value ?? null;
      }
      if (fields.length === 0) return;
      fields.push("updated_at = @updated_at");
      params.updated_at = new Date().toISOString();
      db.prepare(`UPDATE fsgr_runs SET ${fields.join(", ")} WHERE run_id = @run_id`).run(params);
    },

    listRuns(): RunLedger[] {
      const rows = db.prepare("SELECT * FROM fsgr_runs ORDER BY created_at DESC").all() as any[];
      return rows.map((row) => ({
        run_id: row.run_id,
        task_id: row.task_id,
        actor_id: row.actor_id,
        actor_mode: row.actor_mode,
        status: row.status,
        graph_id: row.graph_id,
        plan_mode: row.plan_mode,
        selected_skill_ids: [],
        current_node_ids: [],
        completed_node_ids: [],
        failed_node_ids: [],
        artifact_ids: [],
        trace_id: row.trace_id,
        resume_token: row.resume_token,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    },
  };
}
