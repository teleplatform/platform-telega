import type Database from "better-sqlite3";
import type { Department, Mission, Task, MissionPlan, TaskResult, DepartmentAuditEvent } from "../contracts/department.js";

function parseJsonList(row: any, field: string): string[] {
  try { return JSON.parse(row[field] || "[]"); } catch { return []; }
}
function parseJsonMap(row: any, field: string): Record<string, unknown> {
  try { return JSON.parse(row[field] || "{}"); } catch { return {}; }
}

export function createDepartmentRepos(db: Database.Database) {
  return {
    departments: {
      save(d: Department): void {
        db.prepare(
          `INSERT OR REPLACE INTO departments (department_id, name, domain, profile_type, active_missions_json, roles_json, status, created_at, created_by)
           VALUES (@department_id, @name, @domain, @profile_type, @active_missions_json, @roles_json, @status, @created_at, @created_by)`
        ).run({ ...d, active_missions_json: JSON.stringify(d.active_missions), roles_json: JSON.stringify(d.roles) });
      },
      getById(id: string): Department | null {
        const row = db.prepare("SELECT * FROM departments WHERE department_id = ?").get(id) as any;
        return row ? { ...row, active_missions: parseJsonList(row, "active_missions_json"), roles: parseJsonList(row, "roles_json") } : null;
      },
    },
    missions: {
      save(m: Mission): void {
        db.prepare(
          `INSERT OR REPLACE INTO missions (mission_id, department_id, title, objective, mission_type, constraints_json, success_criteria_json, priority, status, created_at, created_by)
           VALUES (@mission_id, @department_id, @title, @objective, @mission_type, @constraints_json, @success_criteria_json, @priority, @status, @created_at, @created_by)`
        ).run({ ...m, constraints_json: JSON.stringify(m.constraints), success_criteria_json: JSON.stringify(m.success_criteria) });
      },
      getById(id: string): Mission | null {
        const row = db.prepare("SELECT * FROM missions WHERE mission_id = ?").get(id) as any;
        return row ? { ...row, constraints: parseJsonList(row, "constraints_json"), success_criteria: parseJsonList(row, "success_criteria_json") } : null;
      },
      getByDepartment(department_id: string): Mission[] {
        return db.prepare("SELECT * FROM missions WHERE department_id = ?").all(department_id).map((r: any) => ({ ...r, constraints: parseJsonList(r, "constraints_json"), success_criteria: parseJsonList(r, "success_criteria_json") }));
      },
    },
    tasks: {
      save(t: Task): void {
        db.prepare(
          `INSERT OR REPLACE INTO tasks (task_id, mission_id, description, task_type, assigned_role, status, evidence_refs_json, created_at)
           VALUES (@task_id, @mission_id, @description, @task_type, @assigned_role, @status, @evidence_refs_json, @created_at)`
        ).run({ ...t, evidence_refs_json: JSON.stringify(t.evidence_refs) });
      },
      getById(id: string): Task | null {
        const row = db.prepare("SELECT * FROM tasks WHERE task_id = ?").get(id) as any;
        return row ? { ...row, evidence_refs: parseJsonList(row, "evidence_refs_json") } : null;
      },
      getByMission(mission_id: string): Task[] {
        return db.prepare("SELECT * FROM tasks WHERE mission_id = ?").all(mission_id).map((r: any) => ({ ...r, evidence_refs: parseJsonList(r, "evidence_refs_json") }));
      },
    },
    plans: {
      save(p: MissionPlan): void {
        db.prepare(
          `INSERT OR REPLACE INTO mission_plans (mission_id, tasks_json, dependencies_json, generated_at)
           VALUES (@mission_id, @tasks_json, @dependencies_json, @generated_at)`
        ).run({ ...p, tasks_json: JSON.stringify(p.tasks), dependencies_json: JSON.stringify(p.dependencies) });
      },
      getByMission(mission_id: string): MissionPlan | null {
        const row = db.prepare("SELECT * FROM mission_plans WHERE mission_id = ?").get(mission_id) as any;
        return row ? { ...row, tasks: parseJsonList(row, "tasks_json"), dependencies: parseJsonMap(row, "dependencies_json") } : null;
      },
    },
    results: {
      save(r: TaskResult): void {
        db.prepare(
          `INSERT OR REPLACE INTO task_results (task_id, output_json, evidence_refs_json, validated, validation_notes, validated_at)
           VALUES (@task_id, @output_json, @evidence_refs_json, @validated, @validation_notes, @validated_at)`
        ).run({
          task_id: r.task_id,
          output_json: JSON.stringify(r.output),
          evidence_refs_json: JSON.stringify(r.evidence_refs),
          validated: r.validated ? 1 : 0,
          validation_notes: r.validation_notes ?? null,
          validated_at: r.validated_at ?? null,
        });
      },
      getByTask(task_id: string): TaskResult | null {
        const row = db.prepare("SELECT * FROM task_results WHERE task_id = ?").get(task_id) as any;
        return row ? { ...row, output: JSON.parse(row.output_json || "null"), evidence_refs: parseJsonList(row, "evidence_refs_json") } : null;
      },
    },
    audit: {
      append(e: DepartmentAuditEvent): void {
        db.prepare(
          `INSERT INTO department_audit (audit_id, department_id, mission_id, task_id, event_type, actor_id, details_json, created_at)
           VALUES (@audit_id, @department_id, @mission_id, @task_id, @event_type, @actor_id, @details_json, @created_at)`
        ).run({
          audit_id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          department_id: e.department_id,
          mission_id: e.mission_id ?? null,
          task_id: e.task_id ?? null,
          event_type: e.event_type,
          actor_id: e.actor_id,
          details_json: JSON.stringify(e.details ?? {}),
          created_at: e.created_at,
        });
      },
      getTrail(department_id: string, mission_id?: string): DepartmentAuditEvent[] {
        if (mission_id) {
          return db.prepare("SELECT * FROM department_audit WHERE department_id = ? AND mission_id = ? ORDER BY created_at").all(department_id, mission_id) as DepartmentAuditEvent[];
        }
        return db.prepare("SELECT * FROM department_audit WHERE department_id = ? ORDER BY created_at").all(department_id) as DepartmentAuditEvent[];
      },
    },
  };
}

export type DepartmentRepos = ReturnType<typeof createDepartmentRepos>;
