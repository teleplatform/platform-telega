// src/runtime/mission-control/projections/build-task-telegram-projection.ts
// KCA-5.3 — Delivery Projection Layer (pure human-oriented formatting)
// NO transport, NO Telegram sending, NO runtime mutation

import type { MissionControlBuildTaskEvent } from "../build-task-event.js";

export interface BuildTaskTelegramProjection {
  level: "info" | "warning" | "error";
  title: string;
  body: string;
  compact: string;
}

export function projectBuildTaskTelegramMessage(
  event: MissionControlBuildTaskEvent
): BuildTaskTelegramProjection {
  const taskRef = event.title ? `${event.title} (${event.task_id})` : event.task_id;

  switch (event.event_type) {
    case "build_task.completed": {
      const duration = event.duration_ms ? ` • ${Math.round(event.duration_ms / 1000)}s` : "";
      const executor = event.executor_id ? ` via ${event.executor_id}` : "";
      return {
        level: "info",
        title: "🟢 BuildTask completed",
        body: `Task: ${taskRef}${executor}${duration}\nTrace: ${event.trace_id ?? "—"}`,
        compact: `🟢 ${event.task_id} completed${duration}`,
      };
    }

    case "build_task.failed": {
      const reason = event.last_error ? `\nReason: ${event.last_error}` : "";
      return {
        level: "error",
        title: "🔴 BuildTask failed",
        body: `Task: ${taskRef}${reason}\nTrace: ${event.trace_id ?? "—"}`,
        compact: `🔴 ${event.task_id} failed`,
      };
    }

    case "build_task.needs_creator": {
      const reason = event.last_error || event.diagnostics
        ? `\nReason: ${event.last_error ?? JSON.stringify(event.diagnostics)}`
        : "";
      return {
        level: "warning",
        title: "⚠️ BuildTask needs creator",
        body: `Task: ${taskRef}${reason}\nTrace: ${event.trace_id ?? "—"}`,
        compact: `⚠️ ${event.task_id} needs creator`,
      };
    }

    case "build_task.started": {
      const executor = event.executor_target || event.executor_id
        ? ` on ${event.executor_target ?? event.executor_id}`
        : "";
      return {
        level: "info",
        title: "🔵 BuildTask started",
        body: `Task: ${taskRef}${executor}\nTrace: ${event.trace_id ?? "—"}`,
        compact: `🔵 ${event.task_id} started`,
      };
    }

    case "build_task.heartbeat": {
      return {
        level: "info",
        title: "💓 BuildTask heartbeat",
        body: `Task: ${taskRef}\nTrace: ${event.trace_id ?? "—"}`,
        compact: `💓 ${event.task_id} alive`,
      };
    }

    case "build_task.queued": {
      return {
        level: "info",
        title: "⏳ BuildTask queued",
        body: `Task: ${taskRef}\nTrace: ${event.trace_id ?? "—"}`,
        compact: `⏳ ${event.task_id} queued`,
      };
    }

    case "build_task.blocked":
    case "build_task.cancelled":
    case "build_task.timed_out": {
      const reason = event.last_error ? `\nReason: ${event.last_error}` : "";
      return {
        level: "warning",
        title: `⚠️ BuildTask ${event.event_type.split(".")[1]}`,
        body: `Task: ${taskRef}${reason}\nTrace: ${event.trace_id ?? "—"}`,
        compact: `⚠️ ${event.task_id} ${event.event_type.split(".")[1]}`,
      };
    }

    default: {
      return {
        level: "info",
        title: `BuildTask ${event.event_type}`,
        body: `Task: ${taskRef}\nTrace: ${event.trace_id ?? "—"}`,
        compact: `${event.task_id} ${event.event_type}`,
      };
    }
  }
}
