import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import {
  loadTelegramSenderConfig,
  sendTelegramMissionControlMessage,
} from "../mission-control/telegram-sender.js";

export type MissionControlLiveEventKind =
  | "execution_started"
  | "execution_completed"
  | "execution_failed"
  | "approval_required"
  | "incident_opened"
  | "budget_pressure"
  | "doctrine_violation"
  | "federation_risk"
  | "survival_mode";

export interface MissionControlLiveEvent {
  event_id: string;
  kind: MissionControlLiveEventKind;
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  trace_id?: string;
  created_at: string;
  payload?: Record<string, unknown>;
}

let liveEventCounter = 0;

export function renderMissionControlLiveEvent(event: MissionControlLiveEvent): string {
  const trace = event.trace_id ? `\ntrace_id: ${event.trace_id}` : "";
  return [
    `Mission Control Live Event`,
    ``,
    `kind: ${event.kind}`,
    `severity: ${event.severity}`,
    `title: ${event.title}`,
    `event_id: ${event.event_id}`,
    `created_at: ${event.created_at}${trace}`,
  ].join("\n");
}

export async function emitMissionControlLiveEvent(
  input: Omit<MissionControlLiveEvent, "event_id" | "created_at"> & { event_id?: string },
): Promise<MissionControlLiveEvent> {
  liveEventCounter++;
  const event: MissionControlLiveEvent = {
    event_id: input.event_id || `mc_live_${Date.now()}_${liveEventCounter}`,
    kind: input.kind,
    severity: input.severity,
    title: input.title,
    trace_id: input.trace_id,
    created_at: new Date().toISOString(),
    payload: input.payload,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(event.event_id, "mission_control_live_event_emitted"),
    trace_id: event.trace_id || event.event_id,
    job_id: "mission_control",
    type: "mission_control_live_event_emitted",
    timestamp: event.created_at,
    payload: { ...event },
  });

  const cfg = loadTelegramSenderConfig();
  const chatId = cfg.default_chat_id || "0";
  const sendResult = await sendTelegramMissionControlMessage(
    { chat_id: chatId, text: renderMissionControlLiveEvent(event) },
    { ...cfg, enabled: cfg.enabled || !!cfg.dry_run, dry_run: cfg.dry_run !== false },
  );

  await appendEvidenceRecord({
    evidence_id: hashTraceId(event.event_id, "mission_control_live_event_sent"),
    trace_id: event.trace_id || event.event_id,
    job_id: "mission_control",
    type: "mission_control_live_event_sent",
    timestamp: new Date().toISOString(),
    payload: {
      event_id: event.event_id,
      ok: sendResult.ok,
      dry_run: sendResult.dry_run,
      error: sendResult.error,
      chat_id: sendResult.chat_id,
    },
  });

  return event;
}
