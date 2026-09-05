import { ImprovementProposal, LearningSignal } from "./outcomeTypes";
import { getAllSignals } from "./signalDetector";

const proposals: ImprovementProposal[] = [];

let counter = 0;
function genId(prefix: string): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

function generateProposalFromSignal(signal: LearningSignal): ImprovementProposal | null {
  if (signal.confidence < 30) return null;

  const titleMap: Record<string, string> = {
    agent_performance: `Review agent performance: ${signal.description.slice(0, 60)}`,
    provider_performance: `Provider optimization: ${signal.description.slice(0, 60)}`,
    repair_performance: `Repair loop tuning: ${signal.description.slice(0, 60)}`,
    mission_performance: `Mission pattern: ${signal.description.slice(0, 60)}`,
    schedule_slippage: `Schedule adjustment: ${signal.description.slice(0, 60)}`,
  };

  const rationaleMap: Record<string, string> = {
    agent_performance: `Evidence shows recurring pattern. Confidence: ${signal.confidence}%. Review agent configuration and capabilities.`,
    provider_performance: `Provider metrics below threshold. Consider fallback chain reorder or model update.`,
    repair_performance: `Repair loop data suggests tuning max_attempts or failure classification thresholds.`,
    mission_performance: `Mission execution pattern detected. Review planning phase structure.`,
    schedule_slippage: `Schedule deviations detected. Review milestone sizing and dependency windows.`,
  };

  return {
    proposalId: genId("prop"),
    title: titleMap[signal.category] || `Improvement: ${signal.category}`,
    rationale: rationaleMap[signal.category] || `Based on signal: ${signal.description}`,
    evidenceRefs: signal.evidenceRefs,
    confidence: signal.confidence,
    status: "draft",
    category: signal.category,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function generateProposals(): ImprovementProposal[] {
  const signals = getAllSignals();
  const newProposals: ImprovementProposal[] = [];

  for (const signal of signals) {
    const existing = proposals.find((p) =>
      p.evidenceRefs.some((r) => signal.evidenceRefs.includes(r))
    );
    if (existing) continue;

    const proposal = generateProposalFromSignal(signal);
    if (proposal) {
      proposals.push(proposal);
      newProposals.push(proposal);
    }
  }

  return newProposals;
}

export function getAllProposals(): ImprovementProposal[] {
  return [...proposals];
}

export function getProposalsByStatus(status: string): ImprovementProposal[] {
  return proposals.filter((p) => p.status === status);
}

export function updateProposalStatus(
  proposalId: string,
  status: ImprovementProposal["status"]
): ImprovementProposal | null {
  const proposal = proposals.find((p) => p.proposalId === proposalId);
  if (!proposal) return null;

  proposal.status = status;
  proposal.updatedAt = Date.now();
  return proposal;
}
