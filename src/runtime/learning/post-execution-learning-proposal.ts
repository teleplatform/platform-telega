import { getEvidenceByTrace, appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getTraceSummary, getFailedGates, getRetryHistory } from "../evidence/trace-inspector.js";

export type LearningProposalType =
  | "improve_policy"
  | "add_validator"
  | "adjust_capability_score"
  | "add_retry_rule"
  | "improve_prompt_template"
  | "update_docs";

export interface LearningProposal {
  proposal_id: string;
  trace_id: string;
  source_job_id: string;
  type: LearningProposalType;
  title: string;
  description: string;
  evidence: string[];
  severity: "low" | "medium" | "high";
  created_at: string;
}

let proposalCounter = 0;

export function generateProposalsFromTrace(traceId: string): LearningProposal[] {
  const summary = getTraceSummary(traceId);
  if (!summary) return [];

  const proposals: LearningProposal[] = [];
  const records = getEvidenceByTrace(traceId);
  const failedGates = getFailedGates(traceId);
  const retries = getRetryHistory(traceId);
  const jobId = summary.job_id;
  const ts = new Date().toISOString();

  if (failedGates.length > 0) {
    for (const fg of failedGates) {
      proposalCounter++;
      proposals.push({
        proposal_id: `lp_${traceId.slice(0, 8)}_${proposalCounter}`,
        trace_id: traceId,
        source_job_id: jobId,
        type: "add_validator",
        title: `Add validator for gate: ${fg.gate}`,
        description: `Gate "${fg.gate}" failed during execution${fg.message ? `: ${fg.message}` : ""}. Consider adding a pre-execution validator to catch this earlier.`,
        evidence: [`gate_failed:${fg.gate}`],
        severity: fg.message?.includes("error") || fg.message?.includes("fail") ? "high" : "medium",
        created_at: ts,
      });
    }
  }

  if (retries.length > 2) {
    proposalCounter++;
    proposals.push({
      proposal_id: `lp_${traceId.slice(0, 8)}_${proposalCounter}`,
      trace_id: traceId,
      source_job_id: jobId,
      type: "add_retry_rule",
      title: `Adjust retry policy for ${summary.runtime_target || "runtime"}`,
      description: `Execution required ${retries.length} retries. Consider adjusting retry count, backoff, or adding a new capability target.`,
      evidence: retries.map((r) => `retry:${r.attempt}:${r.reason}`),
      severity: retries.length > 5 ? "high" : "medium",
      created_at: ts,
    });
  }

  if (summary.completion_status === "failed_verification" || summary.completion_status === "failed_execution") {
    proposalCounter++;
    const isVerification = summary.completion_status === "failed_verification";
    proposals.push({
      proposal_id: `lp_${traceId.slice(0, 8)}_${proposalCounter}`,
      trace_id: traceId,
      source_job_id: jobId,
      type: "improve_policy",
      title: isVerification ? "Review verification policy" : "Review execution policy for failures",
      description: isVerification
        ? `Trace completed with status failed_verification. Review verification rules for this task kind.`
        : `Trace completed with status failed_execution. Review execution policy rules.`,
      evidence: [`completion_status:${summary.completion_status}`],
      severity: "high",
      created_at: ts,
    });
  }

  const capabilityNegotiated = records.find((r) => r.type === "capability_negotiated");
  if (capabilityNegotiated && capabilityNegotiated.payload?.fallback_chain) {
    proposalCounter++;
    proposals.push({
      proposal_id: `lp_${traceId.slice(0, 8)}_${proposalCounter}`,
      trace_id: traceId,
      source_job_id: jobId,
      type: "adjust_capability_score",
      title: "Recalibrate capability scores after fallback",
      description: `Capability negotiation used fallback chain: ${(capabilityNegotiated.payload.fallback_chain as string[])?.join(" → ")}. Consider adjusting capability scores to prefer the selected runtime.`,
      evidence: [`fallback_chain:${(capabilityNegotiated.payload.fallback_chain as string[])?.join(",")}`],
      severity: "medium",
      created_at: ts,
    });
  }

  return proposals;
}

export async function createLearningProposal(proposal: LearningProposal): Promise<LearningProposal> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(proposal.trace_id, "learning_proposal_created"),
    trace_id: proposal.trace_id,
    job_id: proposal.source_job_id,
    type: "learning_proposal_created",
    timestamp: new Date().toISOString(),
    payload: {
      proposal_id: proposal.proposal_id,
      type: proposal.type,
      title: proposal.title,
      description: proposal.description,
      severity: proposal.severity,
      evidence_refs: proposal.evidence,
    },
  });

  return proposal;
}

export async function generateAndSaveProposals(traceId: string): Promise<LearningProposal[]> {
  const proposals = generateProposalsFromTrace(traceId);
  const saved: LearningProposal[] = [];
  for (const p of proposals) {
    saved.push(await createLearningProposal(p));
  }
  return saved;
}
