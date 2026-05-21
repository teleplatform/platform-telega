import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getIncident } from "./runtime-incident-command.js";
import { createEvolutionProposal } from "../evolution/evolution-proposals.js";
import type { EvolutionProposalType } from "../evolution/evolution-proposals.js";

export interface IncidentLearningProposal {
  proposal_id: string;
  incident_id: string;
  title: string;
  created_at: string;
}

export async function createIncidentLearningProposal(
  incidentId: string,
  title: string,
  description: string,
  proposalType: EvolutionProposalType = "policy_refinement",
): Promise<IncidentLearningProposal> {
  const incident = getIncident(incidentId);
  if (!incident) throw new Error(`Incident ${incidentId} not found`);

  const evolutionProposal = await createEvolutionProposal(
    proposalType,
    title,
    description,
    [incidentId],
    incident.severity === "critical" || incident.severity === "civilization_risk" ? "high" : "medium",
  );

  const proposal: IncidentLearningProposal = {
    proposal_id: evolutionProposal.proposal_id,
    incident_id: incidentId,
    title,
    created_at: new Date().toISOString(),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(proposal.proposal_id, "incident_learning_proposal_created"),
    trace_id: proposal.proposal_id,
    job_id: "incidents",
    type: "incident_learning_proposal_created",
    timestamp: proposal.created_at,
    payload: {
      proposal_id: proposal.proposal_id,
      incident_id: incidentId,
      severity: incident.severity,
      evolution_type: proposalType,
    },
  });

  return proposal;
}
