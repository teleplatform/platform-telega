import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { getIncident } from "./runtime-incident-command.js";

export interface IncidentTimelineEvent {
  timestamp: string;
  type: string;
  description: string;
  evidence_id?: string;
}

export interface IncidentTimeline {
  incident_id: string;
  built_at: string;
  events: IncidentTimelineEvent[];
  total_events: number;
}

export function buildIncidentTimeline(incidentId: string): IncidentTimeline {
  const incident = getIncident(incidentId);
  const events: IncidentTimelineEvent[] = [];

  if (incident) {
    events.push({
      timestamp: incident.opened_at,
      type: "incident_opened",
      description: `Incident opened: ${incident.title}`,
      evidence_id: hashTraceId(incident.incident_id, "runtime_incident_opened"),
    });
  }

  for (const evidenceId of incident?.evidence_links || []) {
    const records = readEvidenceRecords({ trace_id: evidenceId });
    for (const r of records) {
      events.push({
        timestamp: r.timestamp,
        type: r.type,
        description: r.payload?.description as string || r.type,
        evidence_id: r.evidence_id,
      });
    }
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const timeline: IncidentTimeline = {
    incident_id: incidentId,
    built_at: new Date().toISOString(),
    events,
    total_events: events.length,
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(`timeline_${incidentId}`, "incident_timeline_built"),
    trace_id: incidentId,
    job_id: "incidents",
    type: "incident_timeline_built",
    timestamp: timeline.built_at,
    payload: {
      incident_id: incidentId,
      events_count: events.length,
    },
  });

  return timeline;
}

export function getIncidentEvidenceChain(incidentId: string): string[] {
  const incident = getIncident(incidentId);
  if (!incident) return [];
  return [...incident.evidence_links];
}
