import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { checkEvolutionProposalGovernance } from "../hooks/evolution-proposal-governance-hook.js";

export interface AutonomousPlanProposal {
  proposal_id: string;
  title: string;
  description: string;
  phases: string[];
  estimated_packs: number;
  status: "proposed" | "approved" | "denied";
  created_at: string;
  updated_at: string;
}

const PROPOSALS: Map<string, AutonomousPlanProposal> = new Map();
let proposalCounter = 0;

export async function proposeAutonomousPlan(
  title: string,
  description: string,
  phases: string[],
  estimatedPacks: number,
): Promise<AutonomousPlanProposal> {
  proposalCounter++;
  const proposal: AutonomousPlanProposal = {
    proposal_id: `auto_plan_${Date.now()}_${proposalCounter}`,
    title,
    description,
    phases,
    estimated_packs: estimatedPacks,
    status: "proposed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  PROPOSALS.set(proposal.proposal_id, proposal);

  const gate = await checkEvolutionProposalGovernance({
    kind: "autonomous_plan",
    proposal_id: proposal.proposal_id,
    requested_by: "system",
    risk_hint: "high",
  });
  if (gate.decision === "blocked") {
    proposal.status = "denied";
    proposal.updated_at = new Date().toISOString();
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId(proposal.proposal_id, "autonomous_plan_proposed"),
    trace_id: proposal.proposal_id,
    job_id: "planning",
    type: "autonomous_plan_proposed",
    timestamp: proposal.created_at,
    payload: {
      proposal_id: proposal.proposal_id,
      title,
      estimated_packs: estimatedPacks,
    },
  });

  return proposal;
}

export async function approveAutonomousPlan(proposalId: string): Promise<AutonomousPlanProposal | null> {
  const proposal = PROPOSALS.get(proposalId);
  if (!proposal) return null;

  proposal.status = "approved";
  proposal.updated_at = new Date().toISOString();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${proposalId}_approved`, "autonomous_plan_approved"),
    trace_id: proposalId,
    job_id: "planning",
    type: "autonomous_plan_approved",
    timestamp: proposal.updated_at,
    payload: { proposal_id: proposalId, title: proposal.title },
  });

  return proposal;
}

export async function denyAutonomousPlan(proposalId: string): Promise<AutonomousPlanProposal | null> {
  const proposal = PROPOSALS.get(proposalId);
  if (!proposal) return null;

  proposal.status = "denied";
  proposal.updated_at = new Date().toISOString();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${proposalId}_denied`, "autonomous_plan_denied"),
    trace_id: proposalId,
    job_id: "planning",
    type: "autonomous_plan_denied",
    timestamp: proposal.updated_at,
    payload: { proposal_id: proposalId, title: proposal.title },
  });

  return proposal;
}

export function getPendingProposals(): AutonomousPlanProposal[] {
  return Array.from(PROPOSALS.values()).filter((p) => p.status === "proposed");
}
