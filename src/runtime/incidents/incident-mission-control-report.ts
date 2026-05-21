import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getIncident, type Incident } from "./runtime-incident-command.js";
import { buildIncidentTimeline } from "./incident-timeline.js";
import { type PlaybookType } from "./incident-playbooks.js";

export interface IncidentReport {
  report_id: string;
  incident_id: string;
  generated_at: string;
  severity: string;
  affected_modules: string[];
  timeline_events: number;
  status: string;
  recovery_steps: string[];
  recommended_action: string;
  rendered: string;
}

export async function renderIncidentReport(incidentId: string): Promise<IncidentReport> {
  const incident = getIncident(incidentId);
  if (!incident) throw new Error(`Incident ${incidentId} not found`);

  const timeline = buildIncidentTimeline(incidentId);

  const sections: string[] = [
    "╔══════════════════════════════════════╗",
    "║     INCIDENT REPORT                  ║",
    "╚══════════════════════════════════════╝",
    `ID: ${incident.incident_id}`,
    `Title: ${incident.title}`,
    `Severity: ${incident.severity}`,
    `Status: ${incident.status}`,
    `Affected: ${incident.affected.join(", ")}`,
    `Opened: ${incident.opened_at}`,
    incident.resolved_at ? `Resolved: ${incident.resolved_at}` : "",
    "",
    "--- Timeline ---",
    ...timeline.events.map((e) => `  [${e.timestamp}] ${e.type}: ${e.description}`),
    "",
    "--- Recommended Action ---",
    incident.status === "resolved"
      ? "Monitor for recurrence. Consider postmortem."
      : `Investigate and apply appropriate playbook for severity level ${incident.severity}.`,
  ];

  const report: IncidentReport = {
    report_id: `inc_report_${Date.now()}`,
    incident_id: incidentId,
    generated_at: new Date().toISOString(),
    severity: incident.severity,
    affected_modules: incident.affected,
    timeline_events: timeline.total_events,
    status: incident.status,
    recovery_steps: [],
    recommended_action: incident.status === "resolved" ? "Monitor" : "Apply playbook",
    rendered: sections.filter(Boolean).join("\n"),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(report.report_id, "incident_report_rendered"),
    trace_id: report.report_id,
    job_id: "incidents",
    type: "incident_report_rendered",
    timestamp: report.generated_at,
    payload: {
      report_id: report.report_id,
      incident_id: incidentId,
      severity: incident.severity,
    },
  });

  return report;
}

export async function sendIncidentReport(incidentId: string): Promise<IncidentReport> {
  const report = await renderIncidentReport(incidentId);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${report.report_id}_sent`, "incident_report_sent"),
    trace_id: report.report_id,
    job_id: "incidents",
    type: "incident_report_sent",
    timestamp: new Date().toISOString(),
    payload: {
      report_id: report.report_id,
      incident_id: incidentId,
      severity: report.severity,
    },
  });

  return report;
}
