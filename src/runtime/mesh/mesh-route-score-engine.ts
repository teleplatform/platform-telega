import type { MeshNodeInfo, MeshNodeCapability } from './mesh-node-types.js';

export interface ScoreFactors {
  loadBalance: number;
  health: number;
  uptime: number;
  capacity: number;
  connectivity: number;
  preference: number;
}

export interface NodeScore {
  nodeId: string;
  totalScore: number;
  factors: ScoreFactors;
  rank: number;
}

export interface ScoringConfig {
  weights?: {
    loadBalance?: number;
    health?: number;
    uptime?: number;
    capacity?: number;
    connectivity?: number;
    preference?: number;
  };
}

const DEFAULT_WEIGHTS = {
  loadBalance: 0.3,
  health: 0.25,
  uptime: 0.15,
  capacity: 0.15,
  connectivity: 0.1,
  preference: 0.05,
};

export function scoreNode(
  node: MeshNodeInfo,
  capability: MeshNodeCapability,
  config: ScoringConfig = {}
): NodeScore {
  const weights = { ...DEFAULT_WEIGHTS, ...config.weights };

  const loadBalance = calculateLoadBalance(capability);
  const health = calculateHealth(node);
  const uptime = calculateUptime(node);
  const capacity = calculateCapacity(capability);
  const connectivity = calculateConnectivity(node);
  const preference = calculatePreference(node);

  const totalScore =
    loadBalance * weights.loadBalance +
    health * weights.health +
    uptime * weights.uptime +
    capacity * weights.capacity +
    connectivity * weights.connectivity +
    preference * weights.preference;

  return {
    nodeId: node.id,
    totalScore: Math.round(totalScore * 100) / 100,
    factors: {
      loadBalance: Math.round(loadBalance * 100) / 100,
      health: Math.round(health * 100) / 100,
      uptime: Math.round(uptime * 100) / 100,
      capacity: Math.round(capacity * 100) / 100,
      connectivity: Math.round(connectivity * 100) / 100,
      preference: Math.round(preference * 100) / 100,
    },
    rank: 0,
  };
}

export function scoreNodes(
  nodes: MeshNodeInfo[],
  capability: MeshNodeCapability,
  config: ScoringConfig = {}
): NodeScore[] {
  const scores = nodes
    .filter(n => n.status === 'online')
    .map(node => {
      const nodeCap = node.capabilities.find(c => c.runtimeCapability === capability.runtimeCapability);
      if (!nodeCap) return null;
      return scoreNode(node, nodeCap, config);
    })
    .filter((s): s is NodeScore => s !== null);

  scores.sort((a, b) => b.totalScore - a.totalScore);
  scores.forEach((s, i) => { s.rank = i + 1; });

  return scores;
}

function calculateLoadBalance(capability: MeshNodeCapability): number {
  if (capability.capacity === 0) return 0;
  return 1 - (capability.currentLoad / capability.capacity);
}

function calculateHealth(node: MeshNodeInfo): number {
  if (node.status === 'online') return 1;
  if (node.status === 'degraded') return 0.5;
  return 0;
}

function calculateUptime(node: MeshNodeInfo): number {
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.min(node.uptimeMs / dayMs, 1);
}

function calculateCapacity(capability: MeshNodeCapability): number {
  return Math.min(capability.capacity / 10, 1);
}

function calculateConnectivity(node: MeshNodeInfo): number {
  const connections = node.connections.filter(c => c.status === 'active').length;
  return Math.min(connections / 3, 1);
}

function calculatePreference(node: MeshNodeInfo): number {
  // Prefer primary nodes slightly
  return node.kind === 'primary' ? 0.8 : 0.5;
}
