import type { Department, Mission, Task, MissionPlan, TaskResult, DepartmentAuditEvent } from "../contracts/department.js";
import { randomUUID } from "crypto";

function nowIso(): string { return new Date().toISOString(); }
import type { DepartmentRepos } from "../storage/sqlite/departmentRepo.js";

export interface DepartmentDeps {
  repos: DepartmentRepos;
}

export function createDepartmentApi(deps: DepartmentDeps) {
  const { repos } = deps;

  return {
    createDepartment(input: {
      name: string;
      domain: string;
      profile_type: string;
      roles: string[];
      created_by: string;
    }): Department {
      const dept: Department = {
        department_id: `dept_${randomUUID()}`,
        name: input.name,
        domain: input.domain,
        profile_type: input.profile_type,
        active_missions: [],
        roles: input.roles,
        status: "active",
        created_at: nowIso(),
        created_by: input.created_by,
      };
      repos.departments.save(dept);
      repos.audit.append({ department_id: dept.department_id, event_type: "department_created", actor_id: input.created_by, details: { name: dept.name, domain: dept.domain }, created_at: nowIso() });
      return dept;
    },

    createMission(input: {
      department_id: string;
      title: string;
      objective: string;
      mission_type: string;
      constraints: string[];
      success_criteria: string[];
      priority: number;
      created_by: string;
    }): { mission: Mission; error?: string } {
      const dept = repos.departments.getById(input.department_id);
      if (!dept) return { mission: {} as Mission, error: "Department not found" };

      const mission: Mission = {
        mission_id: `mission_${randomUUID()}`,
        department_id: input.department_id,
        title: input.title,
        objective: input.objective,
        mission_type: input.mission_type,
        constraints: input.constraints,
        success_criteria: input.success_criteria,
        priority: input.priority,
        status: "created",
        created_at: nowIso(),
        created_by: input.created_by,
      };
      repos.missions.save(mission);
      repos.departments.save({ ...dept, active_missions: [...dept.active_missions, mission.mission_id] });
      repos.audit.append({ department_id: input.department_id, mission_id: mission.mission_id, event_type: "mission_created", actor_id: input.created_by, details: { title: mission.title, mission_type: mission.mission_type }, created_at: nowIso() });
      return { mission };
    },

    planMission(input: {
      mission_id: string;
      tasks: Array<{ task_id: string; description: string; task_type: string; assigned_role: string; depends_on?: string[] }>;
      planned_by: string;
    }): { plan: MissionPlan; error?: string } {
      const mission = repos.missions.getById(input.mission_id);
      if (!mission) return { plan: {} as MissionPlan, error: "Mission not found" };
      if (mission.status !== "created") return { plan: {} as MissionPlan, error: `Mission status is ${mission.status}, must be created` };

      const taskIds = input.tasks.map(t => t.task_id);
      const deps: Record<string, string[]> = {};
      for (const t of input.tasks) {
        if (t.depends_on && t.depends_on.length > 0) deps[t.task_id] = t.depends_on;
      }
      const plan: MissionPlan = {
        mission_id: input.mission_id,
        tasks: taskIds,
        dependencies: deps,
        generated_at: nowIso(),
      };
      repos.plans.save(plan);

      for (const t of input.tasks) {
        const task: Task = {
          task_id: t.task_id,
          mission_id: input.mission_id,
          description: t.description,
          task_type: t.task_type,
          assigned_role: t.assigned_role,
          status: "pending",
          evidence_refs: [],
          created_at: nowIso(),
        };
        repos.tasks.save(task);
      }

      repos.missions.save({ ...mission, status: "planned" });
      repos.audit.append({ department_id: mission.department_id, mission_id: input.mission_id, event_type: "mission_planned", actor_id: input.planned_by, details: { task_count: taskIds.length }, created_at: nowIso() });
      return { plan };
    },

    executeTask(input: {
      task_id: string;
      output: unknown;
      evidence_refs: string[];
      executed_by: string;
    }): { result: TaskResult; error?: string } {
      const task = repos.tasks.getById(input.task_id);
      if (!task) return { result: {} as TaskResult, error: "Task not found" };
      if (!task.assigned_role) return { result: {} as TaskResult, error: "Task has no assigned role" };
      if (input.evidence_refs.length === 0) return { result: {} as TaskResult, error: "Task result requires evidence refs" };

      const result: TaskResult = {
        task_id: input.task_id,
        output: input.output,
        evidence_refs: input.evidence_refs,
        validated: false,
      };
      repos.results.save(result);
      repos.tasks.save({ ...task, status: "completed" });
      repos.audit.append({ department_id: (repos.missions.getById(task.mission_id)?.department_id) ?? "", mission_id: task.mission_id, task_id: input.task_id, event_type: "task_executed", actor_id: input.executed_by, details: { evidence_count: input.evidence_refs.length }, created_at: nowIso() });
      return { result };
    },

    validateTaskResult(input: {
      task_id: string;
      valid: boolean;
      validation_notes?: string;
      validated_by: string;
    }): { validated: boolean; error?: string } {
      const result = repos.results.getByTask(input.task_id);
      if (!result) return { validated: false, error: "No result found for task" };

      const updated: TaskResult = {
        ...result,
        validated: input.valid,
        validation_notes: input.validation_notes,
        validated_at: input.valid ? nowIso() : result.validated_at,
      };
      repos.results.save(updated);

      if (!input.valid) {
        const task = repos.tasks.getById(input.task_id);
        if (task) repos.tasks.save({ ...task, status: "failed" });
      }

      repos.audit.append({
        department_id: "",
        mission_id: "",
        task_id: input.task_id,
        event_type: input.valid ? "task_validated" : "task_validation_failed",
        actor_id: input.validated_by,
        details: { valid: input.valid, notes: input.validation_notes },
        created_at: nowIso(),
      });
      return { validated: input.valid };
    },

    completeMission(input: {
      mission_id: string;
      completed_by: string;
    }): { completed: boolean; error?: string } {
      const mission = repos.missions.getById(input.mission_id);
      if (!mission) return { completed: false, error: "Mission not found" };
      if (mission.status === "failed") return { completed: false, error: "Mission already failed" };
      if (mission.status === "rolled_back") return { completed: false, error: "Mission already rolled back" };

      const tasks = repos.tasks.getByMission(input.mission_id);
      if (tasks.length === 0) return { completed: false, error: "Mission has no tasks — must be planned first" };

      const failedTasks = tasks.filter(t => t.status === "failed");
      const pendingTasks = tasks.filter(t => t.status === "pending" || t.status === "running");
      if (failedTasks.length > 0) {
        repos.missions.save({ ...mission, status: "failed" });
        repos.audit.append({ department_id: mission.department_id, mission_id: input.mission_id, event_type: "mission_failed", actor_id: input.completed_by, details: { failed_tasks: failedTasks.map(t => t.task_id) }, created_at: nowIso() });
        return { completed: false, error: `Mission has ${failedTasks.length} failed tasks` };
      }
      if (pendingTasks.length > 0) {
        return { completed: false, error: `Mission has ${pendingTasks.length} pending tasks` };
      }

      repos.missions.save({ ...mission, status: "completed" });
      repos.audit.append({ department_id: mission.department_id, mission_id: input.mission_id, event_type: "mission_completed", actor_id: input.completed_by, details: { task_count: tasks.length }, created_at: nowIso() });
      return { completed: true };
    },

    rollbackMission(input: {
      mission_id: string;
      reason: string;
      rolled_back_by: string;
    }): { rolled_back: boolean; error?: string } {
      const mission = repos.missions.getById(input.mission_id);
      if (!mission) return { rolled_back: false, error: "Mission not found" };

      repos.missions.save({ ...mission, status: "rolled_back" });
      repos.audit.append({ department_id: mission.department_id, mission_id: input.mission_id, event_type: "mission_rolled_back", actor_id: input.rolled_back_by, details: { reason: input.reason }, created_at: nowIso() });
      return { rolled_back: true };
    },

    getDepartmentAuditTrail(department_id: string, mission_id?: string): DepartmentAuditEvent[] {
      return repos.audit.getTrail(department_id, mission_id);
    },
  };
}

export type DepartmentApi = ReturnType<typeof createDepartmentApi>;
