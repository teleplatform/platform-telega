import { RoutingProposal } from "./routerTypes";
import { getProviderStats } from "./providerStats";
import { buildProfiles, getBestProvider } from "./routingScores";

const proposals: RoutingProposal[] = [];

let counter = 0;
function genId(): string {
  counter++;
  return `rprop_${Date.now()}_${counter}`;
}

export function generateRoutingProposals(): RoutingProposal[] {
  const profiles = buildProfiles();
  const newProposals: RoutingProposal[] = [];

  for (const profile of profiles) {
    if (profile.preferredProviders.length < 2) continue;

    const current = profile.preferredProviders[0];
    const runnersUp = profile.preferredProviders.slice(1);

    for (const alt of runnersUp) {
      // Only propose if alternative is significantly better
      if (alt.score <= current.score + 5) continue;

      const decision = getBestProvider(profile.taskType);
      if (!decision) continue;

      const proposal: RoutingProposal = {
        proposalId: genId(),
        taskType: profile.taskType,
        currentProvider: current.providerId,
        recommendedProvider: alt.providerId,
        confidence: Math.min(90, Math.round((alt.score - current.score) * 5)),
        reason: `${alt.providerId} scores ${alt.score} vs ${current.providerId}'s ${current.score} for "${profile.taskType}" tasks`,
        evidenceRefs: [`${alt.providerId}:${profile.taskType}`, `${current.providerId}:${profile.taskType}`],
        status: "draft",
        createdAt: Date.now(),
      };

      proposals.push(proposal);
      newProposals.push(proposal);
    }
  }

  return newProposals;
}

export function getAllProposals(): RoutingProposal[] {
  return [...proposals];
}

export function updateProposalStatus(
  proposalId: string,
  status: RoutingProposal["status"]
): RoutingProposal | null {
  const prop = proposals.find((p) => p.proposalId === proposalId);
  if (!prop) return null;
  prop.status = status;
  return prop;
}
