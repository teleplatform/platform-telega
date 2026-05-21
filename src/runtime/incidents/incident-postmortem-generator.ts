import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getIncident } from "./runtime-incident-command.js";
import { buildIncidentTimeline } from "./incident-timeline.js";

export interface Postmortem {
  postmortem_id: string;
  incident_id: string;
  created_at: string;
  what_happened: string;
  root_cause: string;
  impact: string;
  recovery: string;
  prevention: string[];
  follow_up_packs: string[];
}

let postmortemCounter = 0;

export async function generatePostmortem(
  incidentId: string,
  analysis: {
    what_happened: string;
    root_cause: string;
    impact: string;
    recovery: string;
    prevention: string[];
    follow_up_packs?: string[];
  },
): Promise<Postmortem> {
  const incident = getIncident(incidentId);
  if (!incident) throw new Error(`Incident ${incidentId} not found`);

  postmortemCounter++;
  const timeline = buildIncidentTimeline(incidentId);

  const postmortem: Postmortem = {
    postmortem_id: `pm_${Date.now()}_${postmortemCounter}`,
    incident_id: incidentId,
    created_at: new Date().toISOString(),
    what_happened: analysis.what_happened,
    root_cause: analysis.root_cause,
    impact: analysis.impact,
    recovery: analysis.recovery,
    prevention: analysis.prevention,
    follow_up_packs: analysis.follow_up_packs || [],
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(postmortem.postmortem_id, "incident_postmortem_created"),
    trace_id: postmortem.postmortem_id,
    job_id: "incidents",
    type: "incident_postmortem_created",
    timestamp: postmortem.created_at,
    payload: {
      postmortem_id: postmortem.postmortem_id,
      incident_id: incidentId,
      severity: incident.severity,
      timeline_events: timeline.total_events,
    },
  });

  return postmortem;
}
