import type { MeshHardeningReport } from './mesh-hardening-types.js';

export interface MeshBaseline {
  version: string;
  generatedAt: number;
  nodeCount: number;
  contractCount: number;
  capabilityCount: number;
  hash: string;
  data: Record<string, unknown>;
}

export function exportMeshBaseline(state: any): MeshBaseline {
  const baseline: MeshBaseline = {
    version: '1.0.0',
    generatedAt: Date.now(),
    nodeCount: state.nodes?.length || 0,
    contractCount: state.activeContracts?.length || 0,
    capabilityCount: Object.keys(state.capabilitiesSummary || {}).length,
    hash: '',
    data: {
      nodes: state.nodes,
      contracts: state.activeContracts,
      capabilities: state.capabilitiesSummary,
    },
  };

  baseline.hash = hashMeshBaseline(baseline);
  return baseline;
}

export function hashMeshBaseline(baseline: MeshBaseline): string {
  // Simple deterministic hash (in real system use proper crypto)
  const str = JSON.stringify({
    nodeCount: baseline.nodeCount,
    contractCount: baseline.contractCount,
    capabilityCount: baseline.capabilityCount,
    data: baseline.data,
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return 'baseline_' + Math.abs(hash).toString(16);
}

export function compareMeshBaseline(
  current: MeshBaseline,
  previous: MeshBaseline
): { changed: boolean; diff: string[] } {
  const diff: string[] = [];

  if (current.nodeCount !== previous.nodeCount) diff.push('nodeCount');
  if (current.contractCount !== previous.contractCount) diff.push('contractCount');
  if (current.capabilityCount !== previous.capabilityCount) diff.push('capabilityCount');
  if (current.hash !== previous.hash) diff.push('data');

  return {
    changed: diff.length > 0,
    diff,
  };
}
