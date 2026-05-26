import type { TaskGroup, TaskGroupStatus, TaskDependency, DependencyState, TaskReadinessEvaluation, DagResponse, TaskReadiness } from "./task-group-types.js";
import type { TaskGroupBackend } from "./task-group-backend.js";
import { SQLiteTaskGroupBackend } from "./sqlite-task-group-backend.js";

export class TaskGroupStore {
  private groups: Map<string, TaskGroup> = new Map();
  private backend: TaskGroupBackend;

  constructor(backend?: TaskGroupBackend) {
    this.backend = backend ?? taskGroupBackendInstance ?? new SQLiteTaskGroupBackend((globalThis as any).__sqliteDb__);
  }

  async create(params: {
    group_id: string;
    parent_task_id?: string;
    child_task_ids: string[];
    group_strategy: "parallel" | "sequential" | "race";
    execution_mode?: "sandbox" | "creator_only" | "full";
  }): Promise<TaskGroup> {
    const group = await this.backend.createGroup({
      group_id: params.group_id,
      parent_task_id: params.parent_task_id,
      child_task_ids: params.child_task_ids,
      group_strategy: params.group_strategy,
      execution_mode: params.execution_mode,
    });
    this.groups.set(params.group_id, group);
    return group;
  }

  async get(group_id: string): Promise<TaskGroup | undefined> {
    let group = this.groups.get(group_id);
    if (!group) {
      const backendGroup = await this.backend.getGroup(group_id);
      group = backendGroup ?? undefined;
    }
    return group;
  }

  async updateStatus(group_id: string, status: TaskGroupStatus): Promise<TaskGroup | null> {
    const group = await this.backend.updateGroupStatus(group_id, status);
    if (group) {
      this.groups.set(group_id, group);
    }
    return group;
  }

  async addChild(group_id: string, task_id: string): Promise<boolean> {
    const added = await this.backend.addChild(group_id, task_id);
    if (added) {
      const group = this.groups.get(group_id);
      if (group && !group.child_task_ids.includes(task_id)) {
        group.child_task_ids.push(task_id);
        group.updated_at = new Date().toISOString();
      }
    }
    return added;
  }

  async getAll(): Promise<TaskGroup[]> {
    const persisted = await this.backend.getAllGroups();
    for (const group of persisted) {
      this.groups.set(group.group_id, group);
    }
    return Array.from(this.groups.values());
  }

  async clear(): Promise<void> {
    this.groups.clear();
    await this.backend.clear();
  }

  clearCache(): void {
    this.groups.clear();
  }

  async addDependency(params: { group_id: string; task_id: string; depends_on: string }): Promise<TaskDependency> {
    return this.backend.addDependency(params);
  }

  async listDependencies(group_id: string): Promise<TaskDependency[]> {
    return this.backend.listDependencies(group_id);
  }

  async updateDependencyState(task_id: string, depends_on: string, state: DependencyState): Promise<void> {
    return this.backend.updateDependencyState(task_id, depends_on, state);
  }

  async getBlockedTasks(group_id: string): Promise<string[]> {
    return this.backend.getBlockedTasks(group_id);
  }

  async getReadyTasks(group_id: string, childTaskIds: string[]): Promise<string[]> {
    return this.backend.getReadyTasks(group_id, childTaskIds);
  }

  async getTaskGroupDag(group_id: string): Promise<DagResponse> {
    return this.backend.getTaskGroupDag(group_id);
  }

  async evaluateTaskReadiness(group_id: string): Promise<TaskReadinessEvaluation[]> {
    const group = await this.get(group_id);
    if (!group) return [];

    const dependencies = await this.listDependencies(group_id);
    const depMap = new Map<string, TaskDependency[]>();
    for (const dep of dependencies) {
      if (!depMap.has(dep.task_id)) depMap.set(dep.task_id, []);
      depMap.get(dep.task_id)!.push(dep);
    }

    const terminalStates = new Set<DependencyState>(["failed", "blocked", "cancelled"] as DependencyState[]);
    const progressingStates = new Set<DependencyState>(["pending", "running", "queued"] as DependencyState[]);

    const evaluated = new Map<string, TaskReadiness>();

    const evaluateTask = (taskId: string): TaskReadiness => {
      if (evaluated.has(taskId)) return evaluated.get(taskId)!;

      const taskDeps = depMap.get(taskId) ?? [];
      let readiness: TaskReadiness = "ready";

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

    const results: TaskReadinessEvaluation[] = [];
    for (const taskId of group.child_task_ids) {
      const readiness = evaluateTask(taskId);
      const blocking: string[] = [];

      for (const dep of (depMap.get(taskId) ?? [])) {
        if (terminalStates.has(dep.state)) {
          blocking.push(dep.depends_on);
        } else if (progressingStates.has(dep.state)) {
          blocking.push(dep.depends_on);
        } else if (evaluated.get(dep.depends_on) === "failed" || evaluated.get(dep.depends_on) === "blocked") {
          blocking.push(dep.depends_on);
        }
      }

      results.push({ task_id: taskId, readiness, blocking_tasks: blocking });
    }

    return results;
  }
}

let taskGroupStoreInstance: TaskGroupStore | null = null;
let taskGroupBackendInstance: TaskGroupBackend | null = null;

export function getTaskGroupStore(): TaskGroupStore {
  if (!taskGroupStoreInstance) {
    taskGroupStoreInstance = new TaskGroupStore(taskGroupBackendInstance ?? new SQLiteTaskGroupBackend((globalThis as any).__sqliteDb__));
  }
  if (taskGroupBackendInstance && taskGroupStoreInstance["backend"] !== taskGroupBackendInstance) {
    taskGroupStoreInstance = new TaskGroupStore(taskGroupBackendInstance);
  }
  return taskGroupStoreInstance;
}

export function resetTaskGroupStore(): void {
  taskGroupStoreInstance = null;
}

export function resetTaskGroupStoreWithBackend(backend: TaskGroupBackend): void {
  taskGroupBackendInstance = backend;
  taskGroupStoreInstance = new TaskGroupStore(backend);
}

export function setTaskGroupBackend(backend: TaskGroupBackend): void {
  taskGroupBackendInstance = backend;
}

export function getTaskGroupBackend(): TaskGroupBackend | null {
  return taskGroupBackendInstance;
}