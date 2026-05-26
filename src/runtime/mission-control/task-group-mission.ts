import type { TaskGroupStreamEvent } from "../../types/telecore.js";

export function projectTaskGroupMissionMessage(event: TaskGroupStreamEvent): string {
  const { event_type, payload } = event;
  
  switch (event_type) {
    case "group_created":
      return `TaskGroup created with strategy: ${payload.group_strategy}`;
    case "group_dispatch_started":
      return `TaskGroup dispatch started (max concurrency: ${payload.max_concurrency})`;
    case "child_task_started":
      return `Child task started: ${payload.task_id}`;
    case "child_task_completed":
      return `Child task completed: ${payload.task_id} (${payload.status})`;
    case "group_progress":
      return `TaskGroup progress: ${payload.completed}/${payload.total} tasks`;
    case "group_partial":
      return `TaskGroup partial: ${payload.failed_count} tasks failed`;
    case "group_done":
      return `TaskGroup completed: ${payload.dispatched_count} tasks dispatched`;
    case "group_failed":
      return `TaskGroup failed: ${payload.reason}`;
    case "group_needs_creator":
      return `TaskGroup needs creator decision: ${payload.reason}`;
    case "group_cancelled":
      return `TaskGroup cancelled: ${payload.reason}`;
    default:
      return `TaskGroup event: ${event_type}`;
  }
}

export function deliverTaskGroupMissionEvent(event: TaskGroupStreamEvent): void {
  const message = projectTaskGroupMissionMessage(event);
  console.log(`[MissionControl] ${message}`);
}