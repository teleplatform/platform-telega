import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { classifySeverity, type IncidentSeverity } from "./incident-severity-matrix.js";

export type IncidentStatus = "open" | "investigating" | "mitigating" | "resolved";

export interface Incident {
  incident_id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affected: string[];
  evidence_links: string[];
  opened_at: string;
  updated_at: string;
  resolved_at?: string;
}

const INCIDENTS: Map<string, Incident> = new Map();
let incidentCounter = 0;

export async function openIncident(
  title: string,
  description: string,
  affected: string[],
  severity?: IncidentSeverity,
): Promise<Incident> {
  incidentCounter++;
  const resolvedSeverity = severity || classifySeverity(title + " " + description);

  const incident: Incident = {
    incident_id: `inc_${Date.now()}_${incidentCounter}`,
    title,
    description,
    severity: resolvedSeverity,
    status: "open",
    affected,
    evidence_links: [],
    opened_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  INCIDENTS.set(incident.incident_id, incident);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(incident.incident_id, "runtime_incident_opened"),
    trace_id: incident.incident_id,
    job_id: "incidents",
    type: "runtime_incident_opened",
    timestamp: incident.opened_at,
    payload: {
      incident_id: incident.incident_id,
      severity: resolvedSeverity,
      affected,
    },
  });

  return incident;
}

export async function updateIncident(
  incidentId: string,
  updates: Partial<Pick<Incident, "status" | "description" | "severity">>,
): Promise<Incident | null> {
  const incident = INCIDENTS.get(incidentId);
  if (!incident) return null;

  Object.assign(incident, updates, { updated_at: new Date().toISOString() });
  INCIDENTS.set(incidentId, incident);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${incidentId}_update`, "runtime_incident_updated"),
    trace_id: incidentId,
    job_id: "incidents",
    type: "runtime_incident_updated",
    timestamp: incident.updated_at,
    payload: {
      incident_id: incidentId,
      status: incident.status,
      severity: incident.severity,
    },
  });

  return incident;
}

export async function resolveIncident(incidentId: string): Promise<Incident | null> {
  const incident = INCIDENTS.get(incidentId);
  if (!incident) return null;

  incident.status = "resolved";
  incident.resolved_at = new Date().toISOString();
  incident.updated_at = incident.resolved_at;
  INCIDENTS.set(incidentId, incident);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${incidentId}_resolved`, "runtime_incident_resolved"),
    trace_id: incidentId,
    job_id: "incidents",
    type: "runtime_incident_resolved",
    timestamp: incident.resolved_at,
    payload: {
      incident_id: incidentId,
      severity: incident.severity,
      duration_ms: new Date(incident.resolved_at).getTime() - new Date(incident.opened_at).getTime(),
    },
  });

  return incident;
}

export async function linkIncidentToEvidence(incidentId: string, evidenceId: string): Promise<boolean> {
  const incident = INCIDENTS.get(incidentId);
  if (!incident) return false;

  if (!incident.evidence_links.includes(evidenceId)) {
    incident.evidence_links.push(evidenceId);
    INCIDENTS.set(incidentId, incident);
  }
  return true;
}

export function getIncident(incidentId: string): Incident | null {
  return INCIDENTS.get(incidentId) || null;
}

export function getOpenIncidents(): Incident[] {
  return Array.from(INCIDENTS.values()).filter((i) => i.status !== "resolved");
}

export function getIncidentsBySeverity(severity: IncidentSeverity): Incident[] {
  return Array.from(INCIDENTS.values()).filter((i) => i.severity === severity);
}
