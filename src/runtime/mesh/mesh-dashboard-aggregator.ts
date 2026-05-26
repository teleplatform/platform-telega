import type { MeshNodeInfo } from './mesh-node-types.js';
import type { DistributedContractSummary } from './distributed-contract-summary.js';
import type { FailoverSummary } from './failover-summary.js';

export interface MeshDashboardState {
  generatedAt: number;
  nodes: MeshNodeInfo[];
  totalNodes: number;
  onlineNodes: number;
  deadNodes: number;
  capabilitiesSummary: Record<string, number>;
  activeContracts: DistributedContractSummary[];
  recentFailovers: FailoverSummary[];
  healthScore: number;
  metadata: Record<string, unknown>;
}

export interface DashboardSnapshotOptions {
  includeNodes?: boolean;
  includeContracts?: boolean;
  includeFailovers?: boolean;
  maxFailoverEntries?: number;
}

export function buildDashboardState(
  nodes: MeshNodeInfo[] = [],
  contracts: DistributedContractSummary[] = [],
  failovers: FailoverSummary[] = [],
  options: DashboardSnapshotOptions = {}
): MeshDashboardState {
  const now = Date.now();

  const online = nodes.filter(n => n.status === 'online').length;
  const dead = nodes.filter(n => n.status === 'dead').length;

  const capCount: Record<string, number> = {};
  for (const node of nodes) {
    for (const cap of node.capabilities) {
      capCount[cap.runtimeCapability] = (capCount[cap.runtimeCapability] || 0) + 1;
    }
  }

  const healthScore = nodes.length > 0
    ? Math.round((online / nodes.length) * 100)
    : 0;

  return {
    generatedAt: now,
    nodes: options.includeNodes !== false ? nodes : [],
    totalNodes: nodes.length,
    onlineNodes: online,
    deadNodes: dead,
    capabilitiesSummary: capCount,
    activeContracts: options.includeContracts !== false ? contracts : [],
    recentFailovers: options.includeFailovers !== false
      ? failovers.slice(0, options.maxFailoverEntries ?? 20)
      : [],
    healthScore,
    metadata: {},
  };
}

export function renderDashboardCompact(state: MeshDashboardState): string {
  return [
    `Mesh Dashboard @ ${new Date(state.generatedAt).toISOString()}`,
    `Nodes: ${state.totalNodes} (online=${state.onlineNodes}, dead=${state.deadNodes})`,
    `Health: ${state.healthScore}%`,
    `Capabilities: ${Object.keys(state.capabilitiesSummary).length}`,
    `Active Contracts: ${state.activeContracts.length}`,
    `Recent Failovers: ${state.recentFailovers.length}`,
  ].join('\n');
}
