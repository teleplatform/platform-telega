import type { ContractFragment } from './mesh-contract-envelope.js';

export type ConflictResolutionStrategy =
  | 'latest_version'
  | 'latest_timestamp'
  | 'root_node_priority'
  | 'majority_verified'
  | 'manual_override';

export interface ConflictResolutionResult {
  contractId: string;
  resolvedFragments: ContractFragment[];
  revokedFragments: ContractFragment[];
  winningFragmentId: string;
  resolutionStrategy: ConflictResolutionStrategy;
  resolutionReason: string;
  resolvedAt: number;
}

export interface ConflictResolutionContext {
  contractId: string;
  conflicts: Array<{
    fragmentId: string;
    nodeId: string;
    reason: string;
  }>;
  rootNodeId?: string;
  verifiedFragmentIds?: string[];
  manualWinnerId?: string;
}

export function chooseWinningFragment(
  fragments: ContractFragment[],
  strategy: ConflictResolutionStrategy,
  context: Partial<ConflictResolutionContext> = {}
): ContractFragment | null {
  if (fragments.length === 0) return null;
  if (fragments.length === 1) return fragments[0];

  switch (strategy) {
    case 'latest_version':
      return fragments.reduce((best, current) =>
        current.version > best.version ? current : best
      );

    case 'latest_timestamp':
      return fragments.reduce((best, current) =>
        current.timestamp > best.timestamp ? current : best
      );

    case 'root_node_priority':
      if (context.rootNodeId) {
        const rootFragment = fragments.find(f => f.nodeId === context.rootNodeId);
        if (rootFragment) return rootFragment;
      }
      // fallback to latest timestamp if no root match
      return fragments.reduce((best, current) =>
        current.timestamp > best.timestamp ? current : best
      );

    case 'majority_verified':
      if (context.verifiedFragmentIds && context.verifiedFragmentIds.length > 0) {
        const verified = fragments.filter(f =>
          context.verifiedFragmentIds!.includes(f.fragmentId)
        );
        if (verified.length > 0) {
          // prefer highest version among verified
          return verified.reduce((best, current) =>
            current.version > best.version ? current : best
          );
        }
      }
      // fallback
      return fragments.reduce((best, current) =>
        current.timestamp > best.timestamp ? current : best
      );

    case 'manual_override':
      if (context.manualWinnerId) {
        const manual = fragments.find(f => f.fragmentId === context.manualWinnerId);
        if (manual) return manual;
      }
      return fragments.reduce((best, current) =>
        current.timestamp > best.timestamp ? current : best
      );

    default:
      return fragments.reduce((best, current) =>
        current.timestamp > best.timestamp ? current : best
      );
  }
}

export function resolveContractConflict(
  contractId: string,
  conflictingFragments: ContractFragment[],
  strategy: ConflictResolutionStrategy,
  context: Partial<ConflictResolutionContext> = {}
): ConflictResolutionResult {
  const winner = chooseWinningFragment(conflictingFragments, strategy, {
    ...context,
    contractId,
  });

  if (!winner) {
    return {
      contractId,
      resolvedFragments: [],
      revokedFragments: conflictingFragments,
      winningFragmentId: '',
      resolutionStrategy: strategy,
      resolutionReason: 'No winner could be determined',
      resolvedAt: Date.now(),
    };
  }

  const revoked = conflictingFragments.filter(f => f.fragmentId !== winner.fragmentId);

  return {
    contractId,
    resolvedFragments: [winner],
    revokedFragments: revoked,
    winningFragmentId: winner.fragmentId,
    resolutionStrategy: strategy,
    resolutionReason: `Resolved using strategy '${strategy}'`,
    resolvedAt: Date.now(),
  };
}

export function resolveAllContractConflicts(
  contractId: string,
  conflictGroups: ContractFragment[][],
  strategy: ConflictResolutionStrategy,
  context: Partial<ConflictResolutionContext> = {}
): ConflictResolutionResult[] {
  return conflictGroups.map(group =>
    resolveContractConflict(contractId, group, strategy, context)
  );
}

export function markFragmentsRevoked(
  fragments: ContractFragment[]
): ContractFragment[] {
  return fragments.map(fragment => ({
    ...fragment,
    metadata: {
      ...fragment.metadata,
      revoked: true,
      revokedAt: Date.now(),
    },
  }));
}

export function createConflictResolutionSummary(
  result: ConflictResolutionResult
): string {
  const resolvedCount = result.resolvedFragments.length;
  const revokedCount = result.revokedFragments.length;

  return [
    `Contract: ${result.contractId}`,
    `Strategy: ${result.resolutionStrategy}`,
    `Winner: ${result.winningFragmentId}`,
    `Resolved fragments: ${resolvedCount}`,
    `Revoked fragments: ${revokedCount}`,
    `Reason: ${result.resolutionReason}`,
    `Resolved at: ${new Date(result.resolvedAt).toISOString()}`,
  ].join('\n');
}
