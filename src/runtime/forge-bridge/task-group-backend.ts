import type { TaskGroup, TaskGroupStatus, TaskGroupStrategy, TaskDependency, DagResponse } from "./task-group-types.js";

export interface TaskGroupBackend {
  createGroup(params: {
    group_id: string;
    parent_task_id?: string;
    child_task_ids: string[];
    group_strategy: TaskGroupStrategy;
    execution_mode?: "sandbox" | "creator_only" | "full";
  }): Promise<TaskGroup>;

  getGroup(group_id: string): Promise<TaskGroup | null>;

  updateGroupStatus(group_id: string, status: TaskGroupStatus): Promise<TaskGroup | null>;

  addChild(group_id: string, task_id: string): Promise<boolean>;

  listChildren(group_id: string): Promise<string[]>;

  appendGroupEvent(params: {
    group_id: string;
    event_type: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;

  listGroupEvents(group_id: string, fromSequence?: number): Promise<Array<{
    event_id: string;
    group_id: string;
    sequence: number;
    event_type: string;
    created_at: string;
    payload?: Record<string, unknown>;
  }>>;

  getAllGroups(): Promise<TaskGroup[]>;

  clear(): Promise<void>;

  // Dependency methods
  addDependency(params: { group_id: string; task_id: string; depends_on: string }): Promise<TaskDependency>;
  listDependencies(group_id: string): Promise<TaskDependency[]>;
  updateDependencyState(task_id: string, depends_on: string, state: import("./task-group-types.js").DependencyState): Promise<void | string>;
  getBlockedTasks(group_id: string): Promise<string[]>;
  getReadyTasks(group_id: string, childTaskIds: string[]): Promise<string[]>;

  // DAG methods
  getTaskGroupDag(group_id: string): Promise<DagResponse>;
}