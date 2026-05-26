import type { DistributedContractSummary } from './distributed-contract-summary.js';

export function renderContractHealth(contract: DistributedContractSummary): string {
  const pct = contract.healthScore;
  const emoji = pct > 80 ? '🟢' : pct > 50 ? '🟡' : '🔴';
  return `${emoji} ${contract.contractId} — Health ${pct}%`;
}

export function renderContractSummary(contract: DistributedContractSummary): string {
  return [
    `Contract: ${contract.contractId}`,
    `Fragments: ${contract.totalFragments} (${contract.verifiedFragments} verified)`,
    `Nodes: ${contract.participatingNodes.length}`,
    `Conflicts: ${contract.conflicts.total}`,
    `Health: ${contract.healthScore}%`,
  ].join('\n');
}

export function renderContractConflicts(contract: DistributedContractSummary): string {
  if (contract.conflicts.total === 0) return 'No conflicts.';
  const lines = ['Conflicts:'];
  Object.entries(contract.conflicts.byNode).forEach(([node, count]) => {
    lines.push(`  ${node}: ${count}`);
  });
  return lines.join('\n');
}

export function renderContractLineageCompact(contract: DistributedContractSummary): string {
  return `${contract.contractId} | ${contract.verifiedFragments}/${contract.totalFragments} verified | ${contract.participatingNodes.length} nodes`;
}
