import type { ContractFragment } from './mesh-contract-envelope.js';
import type { RemoteContractBinding, BindingStatus } from './remote-contract-binding.js';
import type { VerificationResult, ContractConflict, VerificationResultStatus } from './contract-verification-merge.js';

export interface FragmentSummary {
  total: number;
  byNode: Record<string, number>;
}

export interface BindingSummary {
  total: number;
  byStatus: Record<BindingStatus, number>;
  byNode: Record<string, number>;
}

export interface VerificationSummary {
  total: number;
  verified: number;
  conflicted: number;
  failed: number;
  partial: number;
}

export interface ConflictSummary {
  total: number;
  byNode: Record<string, number>;
}

export interface DistributedContractSummary {
  contractId: string;
  totalFragments: number;
  verifiedFragments: number;
  participatingNodes: string[];
  conflicts: ConflictSummary;
  bindings: BindingSummary;
  verification: VerificationSummary;
  healthScore: number;
  generatedAt: number;
}

export function summarizeContractFragments(fragments: ContractFragment[]): FragmentSummary {
  const byNode: Record<string, number> = {};

  for (const fragment of fragments) {
    byNode[fragment.nodeId] = (byNode[fragment.nodeId] || 0) + 1;
  }

  return {
    total: fragments.length,
    byNode,
  };
}

export function summarizeBindings(bindings: RemoteContractBinding[]): BindingSummary {
  const byStatus: Record<BindingStatus, number> = {
    pending: 0,
    bound: 0,
    verified: 0,
    conflicted: 0,
    revoked: 0,
  };
  const byNode: Record<string, number> = {};

  for (const binding of bindings) {
    byStatus[binding.status] = (byStatus[binding.status] || 0) + 1;
    byNode[binding.nodeId] = (byNode[binding.nodeId] || 0) + 1;
  }

  return {
    total: bindings.length,
    byStatus,
    byNode,
  };
}

export function summarizeVerification(results: VerificationResult[]): VerificationSummary {
  const summary: VerificationSummary = {
    total: results.length,
    verified: 0,
    conflicted: 0,
    failed: 0,
    partial: 0,
  };

  for (const result of results) {
    switch (result.status) {
      case 'verified':
        summary.verified++;
        break;
      case 'conflicted':
        summary.conflicted++;
        break;
      case 'failed':
        summary.failed++;
        break;
      case 'partial':
      case 'merged':
        summary.partial++;
        break;
    }
  }

  return summary;
}

export function summarizeConflicts(conflicts: ContractConflict[]): ConflictSummary {
  const byNode: Record<string, number> = {};

  for (const conflict of conflicts) {
    byNode[conflict.nodeId] = (byNode[conflict.nodeId] || 0) + 1;
  }

  return {
    total: conflicts.length,
    byNode,
  };
}

export function computeContractHealth(summary: Partial<DistributedContractSummary>): number {
  const totalFragments = summary.totalFragments || 0;
  const verified = summary.verifiedFragments || 0;
  const conflictCount = summary.conflicts?.total || 0;

  if (totalFragments === 0) return 0;

  const verificationRatio = verified / totalFragments;
  const conflictPenalty = Math.min(50, conflictCount * 8);

  const baseHealth = Math.round(verificationRatio * 100);
  const health = Math.max(0, Math.min(100, baseHealth - conflictPenalty));

  return health;
}

export function generateDistributedContractSummary(
  contractId: string,
  fragments: ContractFragment[],
  bindings: RemoteContractBinding[] = [],
  verificationResults: VerificationResult[] = [],
  conflicts: ContractConflict[] = []
): DistributedContractSummary {
  const fragmentSummary = summarizeContractFragments(fragments);
  const bindingSummary = summarizeBindings(bindings);
  const verificationSummary = summarizeVerification(verificationResults);
  const conflictSummary = summarizeConflicts(conflicts);

  const verifiedCount = fragments.filter(f =>
    verificationResults.some(v => v.fragmentId === f.fragmentId && v.status === 'verified')
  ).length;

  const participatingNodes = [
    ...new Set([
      ...fragments.map(f => f.nodeId),
      ...bindings.map(b => b.nodeId),
    ]),
  ];

  const partialSummary: Partial<DistributedContractSummary> = {
    totalFragments: fragmentSummary.total,
    verifiedFragments: verifiedCount,
    participatingNodes,
    conflicts: conflictSummary,
    bindings: bindingSummary,
    verification: verificationSummary,
  };

  const healthScore = computeContractHealth(partialSummary);

  return {
    contractId,
    totalFragments: fragmentSummary.total,
    verifiedFragments: verifiedCount,
    participatingNodes,
    conflicts: conflictSummary,
    bindings: bindingSummary,
    verification: verificationSummary,
    healthScore,
    generatedAt: Date.now(),
  };
}
