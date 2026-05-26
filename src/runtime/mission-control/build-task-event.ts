// src/runtime/mission-control/build-task-event.ts
// KCA-5.1 — Mission Event Envelope (canonical BuildTask lifecycle event)

export type MissionControlBuildTaskEventType =
  | "build_task.queued"
  | "build_task.started"
  | "build_task.heartbeat"
  | "build_task.completed"
  | "build_task.failed"
  | "build_task.blocked"
  | "build_task.needs_creator"
  | "build_task.cancelled"
  | "build_task.timed_out"
  | "build_task.retrying"
  | "build_task.retry_scheduled"
  | "build_task.creator_decision";

export type MissionControlBuildTaskEventSeverity =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "critical";

export type MissionControlBuildTaskEventVisibility =
  | "mission_control"
  | "creator_alert"
  | "both";

export interface MissionControlBuildTaskEvent {
  event_id: string;
  event_type: MissionControlBuildTaskEventType;
  task_id: string;
  status: string;
  title?: string;
  result_status?: string;
  trace_id?: string;
  executor_target?: string;
  executor_id?: string;
  duration_ms?: number;
  diagnostics?: unknown;
  last_error?: string;
  decision?: string;
  note?: string;
  created_at: string;
  visibility: MissionControlBuildTaskEventVisibility;
  severity: MissionControlBuildTaskEventSeverity;
}

export interface CreateBuildTaskMissionEventInput {
  event_type: MissionControlBuildTaskEventType;
  task_id: string;
  status: string;
  title?: string;
  result_status?: string;
  trace_id?: string;
  executor_target?: string;
  executor_id?: string;
  duration_ms?: number;
  diagnostics?: unknown;
  last_error?: string;
  decision?: string;
  note?: string;
  retry_count?: number;
}

export function createBuildTaskMissionEvent(
  input: CreateBuildTaskMissionEventInput
): MissionControlBuildTaskEvent {
  const now = new Date().toISOString();
  const event_id = `mc_bte_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const severity = mapBuildTaskStatusToSeverity(input.status, input.event_type);
  const visibility = mapBuildTaskEventVisibility(input.event_type, input.status);

  return {
    event_id,
    event_type: input.event_type,
    task_id: input.task_id,
    status: input.status,
    title: input.title,
    result_status: input.result_status,
    trace_id: input.trace_id,
    executor_target: input.executor_target,
    executor_id: input.executor_id,
    duration_ms: input.duration_ms,
    diagnostics: input.diagnostics,
    last_error: input.last_error,
    decision: input.decision,
    note: input.note,
    created_at: now,
    visibility,
    severity,
  };
}

export function mapBuildTaskStatusToSeverity(
  status: string,
  event_type: MissionControlBuildTaskEventType
): MissionControlBuildTaskEventSeverity {
  if (event_type === "build_task.completed" || status === "done") return "success";
  if (event_type === "build_task.failed" || status === "failed") return "error";
  if (event_type === "build_task.timed_out" || status === "timed_out") return "error";
  if (status === "needs_creator" || event_type === "build_task.needs_creator") return "warning";
  if (status === "blocked" || status === "cancelled") return "warning";
  if (event_type === "build_task.creator_decision" || status === "retrying") return "info";
  if (status === "running" || status === "started" || event_type === "build_task.heartbeat") return "info";
  return "info";
}

export function mapBuildTaskEventVisibility(
  event_type: MissionControlBuildTaskEventType,
  status: string
): MissionControlBuildTaskEventVisibility {
  if (status === "needs_creator" || event_type === "build_task.needs_creator") {
    return "creator_alert";
  }
  if (["build_task.failed", "build_task.timed_out", "build_task.blocked"].includes(event_type)) {
    return "both";
  }
  if (event_type === "build_task.creator_decision") {
    return "creator_alert";
  }
  return "mission_control";
}
