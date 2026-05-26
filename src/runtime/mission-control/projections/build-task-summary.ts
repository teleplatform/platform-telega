// src/runtime/mission-control/projections/build-task-summary.ts
// KCA-5.3 — Lightweight summary projections (pure, no side effects)

import type { MissionControlBuildTaskEvent } from "../build-task-event.js";
import { projectBuildTaskTelegramMessage } from "./build-task-telegram-projection.js";

export interface BuildTaskSummary {
  task_id: string;
  status: string;
  event_type: string;
  title?: string;
  executor?: string;
  duration_ms?: number;
  has_error: boolean;
}

export function projectBuildTaskSummary(event: MissionControlBuildTaskEvent): BuildTaskSummary {
  return {
    task_id: event.task_id,
    status: event.status,
    event_type: event.event_type,
    title: event.title,
    executor: event.executor_id || event.executor_target || undefined,
    duration_ms: event.duration_ms,
    has_error: !!event.last_error,
  };
}

/**
 * Convenience: returns the compact human string using the telegram projection.
 */
export function projectBuildTaskCompact(event: MissionControlBuildTaskEvent): string {
  return projectBuildTaskTelegramMessage(event).compact;
}
