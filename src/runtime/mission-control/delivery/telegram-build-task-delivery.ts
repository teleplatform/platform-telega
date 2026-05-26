// src/runtime/mission-control/delivery/telegram-build-task-delivery.ts
// KCA-5.4 — Telegram Delivery Wiring (thin, isolated delivery layer)
// Rule: Delivery observes runtime. Delivery never controls runtime.

import { appendEvidenceRecord } from "../../evidence/execution-evidence-store.js";
import { hashTraceId } from "../../evidence/execution-hash.js";
import { loadTelegramSenderConfig, sendTelegramMissionControlMessage } from "../telegram-sender.js";
import { projectBuildTaskTelegramMessage } from "../projections/build-task-telegram-projection.js";
import type { MissionControlBuildTaskEvent } from "../build-task-event.js";

export async function deliverBuildTaskMissionEvent(
  event: MissionControlBuildTaskEvent
): Promise<void> {
  const cfg = loadTelegramSenderConfig();

  if (!cfg.enabled) {
    return;
  }

  const projected = projectBuildTaskTelegramMessage(event);

  const text = [projected.title, "", projected.body].join("\n");

  try {
    const result = await sendTelegramMissionControlMessage(
      {
        chat_id: cfg.default_chat_id || "0",
        text,
      },
      cfg
    );

    if (!result.ok && !result.dry_run) {
      await logDeliveryFailure(event, result.error || "send failed");
    }
  } catch (err: any) {
    await logDeliveryFailure(event, String(err));
  }
}

async function logDeliveryFailure(event: MissionControlBuildTaskEvent, error: string) {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(event.event_id, "build_task_delivery_failed"),
    trace_id: event.task_id,
    job_id: "mission_control",
    type: "build_task_delivery_failed",
    timestamp: new Date().toISOString(),
    payload: {
      event_id: event.event_id,
      event_type: event.event_type,
      task_id: event.task_id,
      error,
    },
  });
}
