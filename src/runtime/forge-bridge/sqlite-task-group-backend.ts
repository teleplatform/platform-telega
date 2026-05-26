import Database from "better-sqlite3";
import type { TaskGroup, TaskGroupStatus, TaskGroupStrategy, TaskDependency, DependencyState, DagResponse, DagNode, DagEdge, TaskState } from "./task-group-types.js";
import type { TaskGroupBackend } from "./task-group-backend.js";

export class SQLiteTaskGroupBackend implements TaskGroupBackend {
  constructor(private db: Database.Database) {}

  async createGroup(params: {
    group_id: string;
    parent_task_id?: string;
    child_task_ids: string[];
    group_strategy: TaskGroupStrategy;
    execution_mode?: "sandbox" | "creator_only" | "full";
  }): Promise<TaskGroup> {
    const now = new Date().toISOString();
    const group: TaskGroup = {
      group_id: params.group_id,
      parent_task_id: params.parent_task_id,
      child_task_ids: params.child_task_ids,
      group_status: "queued",
      group_trace_id: `trace_${params.group_id}`,
      group_strategy: params.group_strategy,
      created_at: now,
      updated_at: now,
      execution_mode: params.execution_mode,
      dependencies: [],
    };

    const stmt = this.db.prepare(`
      INSERT INTO task_groups (group_id, parent_task_id, group_status, group_strategy, group_trace_id, created_at, updated_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      params.group_id,
      params.parent_task_id ?? null,
      "queued",
      params.group_strategy,
      `trace_${params.group_id}`,
      now,
      now,
      JSON.stringify({ execution_mode: params.execution_mode })
    );

    const childStmt = this.db.prepare(`
      INSERT INTO task_group_children (group_id, task_id, child_order, created_at)
      VALUES (?, ?, ?, ?)
    `);
    for (let i = 0; i < params.child_task_ids.length; i++) {
      childStmt.run(params.group_id, params.child_task_ids[i], i, now);
    }

    return group;
  }

  async getGroup(group_id: string): Promise<TaskGroup | null> {
    const stmt = this.db.prepare(`SELECT * FROM task_groups WHERE group_id = ?`);
    const row = stmt.get(group_id) as any | undefined;
    if (!row) return null;

    const metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {};
    const dependencies = await this.listDependencies(group_id);
    const children = await this.listChildren(group_id);

    return {
      group_id: row.group_id,
      parent_task_id: row.parent_task_id,
      child_task_ids: children,
      group_status: row.group_status,
      group_trace_id: row.group_trace_id,
      group_strategy: row.group_strategy,
      created_at: row.created_at,
      updated_at: row.updated_at,
      execution_mode: metadata.execution_mode,
      dependencies,
    };
  }

  async updateGroupStatus(group_id: string, status: TaskGroupStatus): Promise<TaskGroup | null> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE task_groups SET group_status = ?, updated_at = ? WHERE group_id = ?
    `);
    stmt.run(status, now, group_id);
    return this.getGroup(group_id);
  }

  async addChild(group_id: string, task_id: string): Promise<boolean> {
    const checkStmt = this.db.prepare(`SELECT 1 FROM task_group_children WHERE group_id = ? AND task_id = ?`);
    if (checkStmt.get(group_id, task_id)) return false;

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO task_group_children (group_id, task_id, child_order, created_at)
      VALUES (?, ?, (SELECT COALESCE(MAX(child_order), -1) + 1 FROM task_group_children WHERE group_id = ?), ?)
    `);
    stmt.run(group_id, task_id, group_id, now);
    return true;
  }

  async listChildren(group_id: string): Promise<string[]> {
    const stmt = this.db.prepare(`
      SELECT task_id FROM task_group_children WHERE group_id = ? ORDER BY child_order
    `);
    const rows = stmt.all(group_id) as Array<{ task_id: string }>;
    return rows.map(r => r.task_id);
  }

  async appendGroupEvent(params: {
    group_id: string;
    event_type: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const eventId = `${params.group_id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO task_group_events (event_id, group_id, sequence, event_type, created_at, payload_json)
      VALUES (?, ?, (SELECT COALESCE(MAX(sequence), 0) + 1 FROM task_group_events WHERE group_id = ?), ?, ?, ?)
    `);
    stmt.run(eventId, params.group_id, params.group_id, params.event_type, now, params.payload ? JSON.stringify(params.payload) : null);
  }

  async listGroupEvents(group_id: string, fromSequence?: number): Promise<Array<{
    event_id: string;
    group_id: string;
    sequence: number;
    event_type: string;
    created_at: string;
    payload?: Record<string, unknown>;
  }>> {
    const stmt = this.db.prepare(`
      SELECT event_id, group_id, sequence, event_type, created_at, payload_json
      FROM task_group_events
      WHERE group_id = ? ${fromSequence ? "AND sequence > ?" : ""}
      ORDER BY sequence
    `);

    const rows = fromSequence
      ? stmt.all(group_id, fromSequence) as any[]
      : stmt.all(group_id) as any[];

    return rows.map(row => ({
      event_id: row.event_id,
      group_id: row.group_id,
      sequence: row.sequence,
      event_type: row.event_type,
      created_at: row.created_at,
      payload: row.payload_json ? JSON.parse(row.payload_json) : undefined,
    }));
  }

  async getAllGroups(): Promise<TaskGroup[]> {
    const stmt = this.db.prepare(`SELECT * FROM task_groups ORDER BY created_at DESC`);
    const rows = stmt.all() as any[];
    return Promise.all(rows.map(async row => {
      const metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {};
      const children = await this.listChildren(row.group_id);
      return {
        group_id: row.group_id,
        parent_task_id: row.parent_task_id,
        child_task_ids: children,
        group_status: row.group_status,
        group_trace_id: row.group_trace_id,
        group_strategy: row.group_strategy,
        created_at: row.created_at,
        updated_at: row.updated_at,
        execution_mode: metadata.execution_mode,
        dependencies: [],
      };
    }));
  }

  async clear(): Promise<void> {
    this.db.exec(`DELETE FROM task_dependencies`);
    this.db.exec(`DELETE FROM task_group_events`);
    this.db.exec(`DELETE FROM task_group_children`);
    this.db.exec(`DELETE FROM task_groups`);
  }

  // Dependency methods
  async addDependency(params: { group_id: string; task_id: string; depends_on: string }): Promise<TaskDependency> {
    const now = new Date().toISOString();
    const id = `${params.group_id}_${params.task_id}_dep_${params.depends_on}`;
    const stmt = this.db.prepare(`
      INSERT INTO task_dependencies (id, group_id, task_id, depends_on, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, params.group_id, params.task_id, params.depends_on, "pending", now, now);
    return { task_id: params.task_id, depends_on: params.depends_on, state: "pending" };
  }

  async listDependencies(group_id: string): Promise<TaskDependency[]> {
    const stmt = this.db.prepare(`
      SELECT task_id, depends_on, state FROM task_dependencies WHERE group_id = ?
    `);
    const rows = stmt.all(group_id) as Array<{ task_id: string; depends_on: string; state: DependencyState }>;
    return rows.map(r => ({ task_id: r.task_id, depends_on: r.depends_on, state: r.state }));
  }

  async updateDependencyState(task_id: string, depends_on: string, state: DependencyState): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE task_dependencies SET state = ?, updated_at = ? WHERE task_id = ? AND depends_on = ?
    `).run(state, now, task_id, depends_on);
  }

  async getBlockedTasks(group_id: string): Promise<string[]> {
    const stmt = this.db.prepare(`
      SELECT task_id FROM task_dependencies WHERE group_id = ? AND state = 'blocked'
    `);
    const rows = stmt.all(group_id) as Array<{ task_id: string }>;
    return [...new Set(rows.map(r => r.task_id))];
  }

  async getReadyTasks(group_id: string, childTaskIds: string[]): Promise<string[]> {
    const deps = await this.listDependencies(group_id);
    const blockedBy = new Set(deps.filter(d => d.state === 'blocked').map(d => d.task_id));
    return childTaskIds.filter(id => !blockedBy.has(id));
  }

  async getTaskGroupDag(group_id: string): Promise<DagResponse> {
    const group = await this.getGroup(group_id);
    if (!group) {
      throw new Error(`Group ${group_id} not found`);
    }

    const dependencies = await this.listDependencies(group_id);
    const readinessEval = await this.evaluateReadiness(group_id, group.child_task_ids);

    const readinessMap = new Map(readinessEval.map(r => [r.task_id, r]));

    const nodes: DagNode[] = group.child_task_ids.map(taskId => {
      const readinessEval = readinessMap.get(taskId);
      let state: TaskState = "queued";
      if (readinessEval?.readiness === "failed") state = "failed";
      else if (readinessEval?.readiness === "blocked") state = "blocked";
      return { task_id: taskId, state };
    });

    const edges: DagEdge[] = dependencies.map(dep => ({
      from: dep.depends_on,
      to: dep.task_id,
    }));

    const ready_tasks = readinessEval.filter(r => r.readiness === "ready").map(r => r.task_id);
    const blocked_tasks = readinessEval.filter(r => r.readiness === "blocked").map(r => r.task_id);
    const failed_tasks = readinessEval.filter(r => r.readiness === "failed").map(r => r.task_id);
    const blocking_tasks = readinessEval.flatMap(r => r.blocking_tasks);

    return { group_id, nodes, edges, ready_tasks, blocked_tasks, failed_tasks, blocking_tasks };
  }

  private async evaluateReadiness(group_id: string, childTaskIds: string[]): Promise<{ task_id: string; readiness: "ready" | "blocked" | "failed"; blocking_tasks: string[] }[]> {
    const dependencies = await this.listDependencies(group_id);
    const depMap = new Map<string, TaskDependency[]>();
    for (const dep of dependencies) {
      if (!depMap.has(dep.task_id)) depMap.set(dep.task_id, []);
      depMap.get(dep.task_id)!.push(dep);
    }

    const terminalStates = new Set<DependencyState>(["failed", "blocked", "cancelled"] as DependencyState[]);
    const progressingStates = new Set<DependencyState>(["pending", "running", "queued"] as DependencyState[]);

    const evaluated = new Map<string, "ready" | "blocked" | "failed">();

    const evaluateTask = (taskId: string): "ready" | "blocked" | "failed" => {
      if (evaluated.has(taskId)) return evaluated.get(taskId)!;

      const taskDeps = depMap.get(taskId) ?? [];
      let readiness: "ready" | "blocked" | "failed" = "ready";

      for (const dep of taskDeps) {
        const upstreamReadiness = evaluateTask(dep.depends_on);
        if (terminalStates.has(dep.state) || upstreamReadiness === "failed") {
          readiness = "failed";
        } else if (progressingStates.has(dep.state) || upstreamReadiness === "blocked") {
          readiness = "blocked";
        }
      }

      evaluated.set(taskId, readiness);
      return readiness;
    };

    return childTaskIds.map(taskId => {
      const readiness = evaluateTask(taskId);
      const blocking: string[] = [];
      for (const dep of (depMap.get(taskId) ?? [])) {
        if (terminalStates.has(dep.state) || evaluated.get(dep.depends_on) === "failed") {
          blocking.push(dep.depends_on);
        } else if (progressingStates.has(dep.state)) {
          blocking.push(dep.depends_on);
        }
      }
      return { task_id: taskId, readiness, blocking_tasks: blocking };
    });
  }
}