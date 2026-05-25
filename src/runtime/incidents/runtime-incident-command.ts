import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";
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
      title,
      description,
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

export async function restoreIncidentsFromEvidence(): Promise<Incident[]> {
  const records = readEvidenceRecords({ order: "asc" });
  const restored = new Map<string, Incident>();

  for (const record of records) {
    if (record.type === "runtime_incident_opened") {
      const incidentId = String(record.payload?.incident_id || record.trace_id);
      restored.set(incidentId, {
        incident_id: incidentId,
        title: String(record.payload?.title || `Recovered incident ${incidentId}`),
        description: String(record.payload?.description || "Recovered from evidence"),
        severity: (record.payload?.severity as IncidentSeverity) || "medium",
        status: "open",
        affected: Array.isArray(record.payload?.affected) ? record.payload.affected.map(String) : [],
        evidence_links: [],
        opened_at: record.timestamp,
        updated_at: record.timestamp,
      });
    }

    if (record.type === "runtime_incident_updated" || record.type === "runtime_incident_resolved") {
      const incidentId = String(record.payload?.incident_id || record.trace_id);
      const incident = restored.get(incidentId);
      if (!incident) continue;
      if (record.payload?.status) incident.status = record.payload.status as IncidentStatus;
      if (record.payload?.severity) incident.severity = record.payload.severity as IncidentSeverity;
      if (record.type === "runtime_incident_resolved") {
        incident.status = "resolved";
        incident.resolved_at = record.timestamp;
      }
      incident.updated_at = record.timestamp;
      restored.set(incidentId, incident);
    }
  }

  for (const incident of restored.values()) {
    INCIDENTS.set(incident.incident_id, incident);
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`incident_restore_${Date.now()}`, "incident_recovery_restored"),
    trace_id: "runtime_recovery",
    job_id: "mission_control",
    type: "incident_recovery_restored",
    timestamp: new Date().toISOString(),
    payload: {
      restored: restored.size,
      open: Array.from(restored.values()).filter((incident) => incident.status !== "resolved").length,
    },
  });

  return Array.from(restored.values());
}
