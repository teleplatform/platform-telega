import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { openIncident, type Incident } from "../incidents/runtime-incident-command.js";
import { classifySeverity, type IncidentSeverity } from "../incidents/incident-severity-matrix.js";
import { emitMissionControlLiveEvent } from "./mission-control-live-feed-hook.js";
import {
  loadTelegramSenderConfig,
  sendTelegramMissionControlMessage,
} from "../mission-control/telegram-sender.js";
import { routeRuntimeAttention, routeRuntimeIncident } from "../mission-control/operational-runtime.js";

export type RuntimeIncidentSignalKind =
  | "execution_failed"
  | "governance_blocked"
  | "budget_exhausted"
  | "drift_escalated"
  | "unauthorized_callback"
  | "replay_storm"
  | "federation_failure";

export interface RuntimeIncidentEscalationInput {
  kind: RuntimeIncidentSignalKind;
  title?: string;
  description: string;
  trace_id?: string;
  affected?: string[];
  evidence_id?: string;
  severity_hint?: IncidentSeverity;
  force?: boolean;
}

export interface RuntimeIncidentEscalationResult {
  escalated: boolean;
  severity: IncidentSeverity;
  incident?: Incident;
  reason: string;
}

function shouldEscalate(input: RuntimeIncidentEscalationInput, severity: IncidentSeverity): boolean {
  if (input.force) return true;
  if (input.kind === "budget_exhausted" || input.kind === "replay_storm" || input.kind === "federation_failure") return true;
  return ["medium", "high", "critical", "civilization_risk"].includes(severity);
}

export async function escalateRuntimeIncident(
  input: RuntimeIncidentEscalationInput,
): Promise<RuntimeIncidentEscalationResult> {
  const severity = input.severity_hint || classifySeverity(`${input.kind} ${input.description}`);
  const incident = await openIncident(
    input.title || `Runtime ${input.kind}`,
    input.description,
    input.affected || [input.kind],
    severity,
  );

  await appendEvidenceRecord({
    evidence_id: hashTraceId(incident.incident_id, "runtime_incident_auto_escalated"),
    trace_id: input.trace_id || incident.incident_id,
    job_id: "incidents",
    type: "runtime_incident_auto_escalated",
    timestamp: new Date().toISOString(),
    payload: {
      incident_id: incident.incident_id,
      kind: input.kind,
      severity,
      evidence_id: input.evidence_id,
    },
  });

  await emitMissionControlLiveEvent({
    kind: "incident_opened",
    severity: severity === "civilization_risk" ? "critical" : severity === "info" ? "low" : severity,
    title: incident.title,
    trace_id: input.trace_id || incident.incident_id,
    payload: { incident_id: incident.incident_id, kind: input.kind },
  });

  const routing = await routeRuntimeIncident({
    incident,
    kind: input.kind,
    trace_id: input.trace_id || incident.incident_id,
  });

  await routeRuntimeAttention({
    severity: severity === "civilization_risk" ? "critical" : severity === "info" ? "low" : severity,
    title: incident.title,
    trace_id: input.trace_id || incident.incident_id,
    payload: {
      incident_id: incident.incident_id,
      playbook_id: routing.playbook.playbook_id,
      escalation_path: routing.escalation_path,
    },
  });

  await sendIncidentTelegramAlert(incident, input.trace_id || incident.incident_id, input.kind);

  return { escalated: true, severity, incident, reason: "Incident auto-escalated" };
}

export function renderIncidentTelegramAlert(
  incident: Incident,
  traceId: string,
  kind: RuntimeIncidentSignalKind,
): string {
  return [
    "Mission Control Incident Alert",
    "",
    `severity: ${incident.severity}`,
    `kind: ${kind}`,
    `title: ${incident.title}`,
    `incident_id: ${incident.incident_id}`,
    `trace_id: ${traceId}`,
    `status: ${incident.status}`,
    `affected: ${incident.affected.join(", ") || "-"}`,
    `opened_at: ${incident.opened_at}`,
    "",
    incident.description,
  ].join("\n");
}

export async function sendIncidentTelegramAlert(
  incident: Incident,
  traceId: string,
  kind: RuntimeIncidentSignalKind,
): Promise<void> {
  if (!["high", "critical", "civilization_risk"].includes(incident.severity)) return;
  const cfg = loadTelegramSenderConfig();
  const chatId = cfg.default_chat_id || "0";
  const sendResult = await sendTelegramMissionControlMessage(
    { chat_id: chatId, text: renderIncidentTelegramAlert(incident, traceId, kind) },
    { ...cfg, enabled: cfg.enabled || !!cfg.dry_run, dry_run: cfg.dry_run !== false },
  );
  await appendEvidenceRecord({
    evidence_id: hashTraceId(incident.incident_id, "mission_control_incident_alert_sent"),
    trace_id: traceId,
    job_id: "incidents",
    type: "telegram_mission_control_message_sent",
    timestamp: new Date().toISOString(),
    payload: {
      incident_id: incident.incident_id,
      severity: incident.severity,
      ok: sendResult.ok,
      dry_run: sendResult.dry_run,
      chat_id: sendResult.chat_id,
      error: sendResult.error,
    },
  });
}

export async function maybeEscalateRuntimeIncident(
  input: RuntimeIncidentEscalationInput,
): Promise<RuntimeIncidentEscalationResult> {
  const severity = input.severity_hint || classifySeverity(`${input.kind} ${input.description}`);
  const escalate = shouldEscalate(input, severity);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.trace_id || `${input.kind}_${Date.now()}`, "runtime_incident_auto_escalation_checked"),
    trace_id: input.trace_id || input.kind,
    job_id: "incidents",
    type: "runtime_incident_auto_escalation_checked",
    timestamp: new Date().toISOString(),
    payload: {
      kind: input.kind,
      severity,
      escalated: escalate,
      evidence_id: input.evidence_id,
    },
  });

  if (!escalate) {
    return { escalated: false, severity, reason: "Signal below escalation threshold" };
  }

  return escalateRuntimeIncident(input);
}
