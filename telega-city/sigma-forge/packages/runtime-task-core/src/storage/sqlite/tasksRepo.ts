import type Database from "better-sqlite3";
import type { AsyncTask } from "../../runtime-task-contracts/src/task.js";

export function createTasksRepo(db: Database.Database) {
  return {
    saveTask(task: AsyncTask): void {
      db.prepare(
        `INSERT OR REPLACE INTO runtime_async_tasks (task_id, tele_user_id, workspace_id, session_id, run_id, goal, task_class, status, execution_mode, risk_level, budget_estimate, delivery_targets_json, created_at, updated_at)
         VALUES (@task_id, @tele_user_id, @workspace_id, @session_id, @run_id, @goal, @task_class, @status, @execution_mode, @risk_level, @budget_estimate, @delivery_targets_json, @created_at, @updated_at)`
      ).run({
        task_id: task.task_id,
        tele_user_id: task.tele_user_id,
        workspace_id: task.workspace_id ?? null,
        session_id: task.session_id ?? null,
        run_id: task.run_id ?? null,
        goal: task.goal,
        task_class: task.task_class ?? null,
        status: task.status,
        execution_mode: task.execution_mode ?? null,
        risk_level: task.risk_level,
        budget_estimate: task.budget_estimate ?? null,
        delivery_targets_json: JSON.stringify(task.delivery_targets),
        created_at: task.created_at,
        updated_at: task.updated_at,
      });
    },
    getTask(task_id: string): AsyncTask | null {
      const row = db.prepare("SELECT * FROM runtime_async_tasks WHERE task_id = ?").get(task_id);
      if (!row) return null;
      const r = row as any;
      return { ...r, delivery_targets: JSON.parse(r.delivery_targets_json || "[]") };
    },
    listTasks(filters?: { tele_user_id?: string; status?: string }): AsyncTask[] {
      let sql = "SELECT * FROM runtime_async_tasks WHERE 1=1";
      const params: any[] = [];
      if (filters?.tele_user_id) { sql += " AND tele_user_id = ?"; params.push(filters.tele_user_id); }
      if (filters?.status) { sql += " AND status = ?"; params.push(filters.status); }
      sql += " ORDER BY created_at DESC";
      const rows = db.prepare(sql).all(...params);
      return rows.map((r: any) => ({ ...r, delivery_targets: JSON.parse(r.delivery_targets_json || "[]") }));
    },
    updateTask(task_id: string, patch: Partial<AsyncTask>): void {
      const fields: string[] = [];
      const params: any = { task_id };
      for (const [key, value] of Object.entries(patch)) {
        if (key === "task_id") continue;
        const dbKey = key === "delivery_targets" ? "delivery_targets_json" : key;
        fields.push(`${dbKey} = @${dbKey}`);
        params[dbKey] = key === "delivery_targets" ? JSON.stringify(value) : value;
      }
      if (fields.length === 0) return;
      fields.push("updated_at = @updated_at");
      params.updated_at = new Date().toISOString();
      db.prepare(`UPDATE runtime_async_tasks SET ${fields.join(", ")} WHERE task_id = @task_id`).run(params);
    },
  };
}
