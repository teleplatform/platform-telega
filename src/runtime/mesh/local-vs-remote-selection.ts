import type { MeshNodeInfo, RuntimeCapability } from './mesh-node-types.js';

export interface SelectionDecision {
  selectedNodeId: string;
  selectedNodeName: string;
  selectionType: 'local' | 'remote';
  reason: string;
  alternatives: { nodeId: string; type: 'local' | 'remote'; score: number }[];
  timestamp: number;
}

export interface SelectionCriteria {
  capability: RuntimeCapability;
  preferLocal?: boolean;
  preferRemote?: boolean;
  requireLocal?: boolean;
  requireRemote?: boolean;
  maxLatencyMs?: number;
}

export function selectLocalOrRemote(
  nodes: MeshNodeInfo[],
  criteria: SelectionCriteria
): SelectionDecision {
  const localNodes = nodes.filter(n => n.kind === 'primary' && n.status === 'online');
  const remoteNodes = nodes.filter(n => n.kind !== 'primary' && n.status === 'online');

  const localCandidates = localNodes.filter(n =>
    n.capabilities.some(c => c.runtimeCapability === criteria.capability)
  );

  const remoteCandidates = remoteNodes.filter(n =>
    n.capabilities.some(c => c.runtimeCapability === criteria.capability)
  );

  let selected = localCandidates[0] || remoteCandidates[0];
  let selectionType: 'local' | 'remote' = selected?.kind === 'primary' ? 'local' : 'remote';

  // Apply criteria
  if (criteria.requireLocal && localCandidates.length > 0) {
    selected = localCandidates[0];
    selectionType = 'local';
  } else if (criteria.requireRemote && remoteCandidates.length > 0) {
    selected = remoteCandidates[0];
    selectionType = 'remote';
  } else if (criteria.preferLocal && localCandidates.length > 0) {
    selected = localCandidates[0];
    selectionType = 'local';
  } else if (criteria.preferRemote && remoteCandidates.length > 0) {
    selected = remoteCandidates[0];
    selectionType = 'remote';
  }

  const alternatives = [
    ...localCandidates.slice(0, 2).map(n => ({ nodeId: n.id, type: 'local' as const, score: 100 })),
    ...remoteCandidates.slice(0, 2).map(n => ({ nodeId: n.id, type: 'remote' as const, score: 85 })),
  ].slice(0, 3);

  return {
    selectedNodeId: selected?.id || '',
    selectedNodeName: selected?.name || '',
    selectionType,
    reason: getSelectionReason(selectionType, criteria),
    alternatives,
    timestamp: Date.now(),
  };
}

function getSelectionReason(type: 'local' | 'remote', criteria: SelectionCriteria): string {
  if (criteria.requireLocal) return 'local required by criteria';
  if (criteria.requireRemote) return 'remote required by criteria';
  if (criteria.preferLocal) return 'local preferred';
  if (criteria.preferRemote) return 'remote preferred';
  return type === 'local' ? 'local available' : 'remote selected';
}

export function analyzeNodeDistribution(nodes: MeshNodeInfo[]): {
  localNodes: number;
  remoteNodes: number;
  localCapabilities: Record<string, number>;
  remoteCapabilities: Record<string, number>;
  gapAnalysis: { capability: string; localCount: number; remoteCount: number }[];
} {
  const localNodes = nodes.filter(n => n.kind === 'primary');
  const remoteNodes = nodes.filter(n => n.kind !== 'primary');

  const localCaps: Record<string, number> = {};
  const remoteCaps: Record<string, number> = {};

  for (const node of localNodes) {
    for (const cap of node.capabilities) {
      localCaps[cap.runtimeCapability] = (localCaps[cap.runtimeCapability] || 0) + 1;
    }
  }

  for (const node of remoteNodes) {
    for (const cap of node.capabilities) {
      remoteCaps[cap.runtimeCapability] = (remoteCaps[cap.runtimeCapability] || 0) + 1;
    }
  }

  const allCaps = new Set([...Object.keys(localCaps), ...Object.keys(remoteCaps)]);
  const gapAnalysis = Array.from(allCaps).map(cap => ({
    capability: cap,
    localCount: localCaps[cap] || 0,
    remoteCount: remoteCaps[cap] || 0,
  }));

  return {
    localNodes: localNodes.length,
    remoteNodes: remoteNodes.length,
    localCapabilities: localCaps,
    remoteCapabilities: remoteCaps,
    gapAnalysis,
  };
}
