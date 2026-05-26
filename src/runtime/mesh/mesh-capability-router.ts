import type { MeshNodeInfo, RuntimeCapability, TaskType } from './mesh-node-types.js';
import { buildCapabilityIndex, getBestNodeForCapability, getNodesForCapability, type CapabilityIndex } from './mesh-capability-index.js';

export interface RouteDecision {
  capability: RuntimeCapability;
  taskType: TaskType;
  selectedNodeId: string;
  selectedNodeName: string;
  nodeAddress: string;
  score: number;
  routeType: 'local' | 'remote';
  alternatives: { nodeId: string; score: number; reason: string }[];
  timestamp: number;
}

export interface RoutingRequest {
  capability: RuntimeCapability;
  taskType: TaskType;
  preferredNodeId?: string;
  requireLocal?: boolean;
  requireRemote?: boolean;
}

export function routeCapability(
  nodes: MeshNodeInfo[],
  request: RoutingRequest
): RouteDecision {
  const index = buildCapabilityIndex(nodes);
  const entry = getNodesForCapability(index, request.capability);

  if (!entry || entry.nodes.length === 0) {
    return {
      capability: request.capability,
      taskType: request.taskType,
      selectedNodeId: '',
      selectedNodeName: '',
      nodeAddress: '',
      score: 0,
      routeType: 'local',
      alternatives: [],
      timestamp: Date.now(),
    };
  }

  let selectedNode = entry.nodes[0];

  // Filter by preference
  if (request.preferredNodeId) {
    const preferred = entry.nodes.find(n => n.nodeId === request.preferredNodeId);
    if (preferred) {
      selectedNode = preferred;
    }
  }

  // Filter by local/remote requirement
  if (request.requireLocal) {
    const local = entry.nodes.find(n => n.nodeInfo.id === selectedNode.nodeInfo.id && isLocalNode(n.nodeInfo));
    if (local) selectedNode = local;
  }

  if (request.requireRemote) {
    const remote = entry.nodes.find(n => !isLocalNode(n.nodeInfo));
    if (remote) selectedNode = remote;
  }

  const alternatives = entry.nodes
    .slice(0, 3)
    .map(n => ({
      nodeId: n.nodeId,
      score: n.score,
      reason: getNodeSelectionReason(n.nodeInfo),
    }));

  return {
    capability: request.capability,
    taskType: request.taskType,
    selectedNodeId: selectedNode.nodeId,
    selectedNodeName: selectedNode.nodeInfo.name,
    nodeAddress: selectedNode.nodeInfo.address,
    score: selectedNode.score,
    routeType: isLocalNode(selectedNode.nodeInfo) ? 'local' : 'remote',
    alternatives,
    timestamp: Date.now(),
  };
}

export function batchRouteCapabilities(
  nodes: MeshNodeInfo[],
  requests: RoutingRequest[]
): RouteDecision[] {
  return requests.map(req => routeCapability(nodes, req));
}

function isLocalNode(node: MeshNodeInfo): boolean {
  return node.kind === 'primary';
}

function getNodeSelectionReason(node: MeshNodeInfo): string {
  const reasons: string[] = [];
  if (node.status === 'online') reasons.push('online');
  if (node.workerCount > 0) reasons.push(`workers=${node.workerCount}`);
  if (node.connections.length > 0) reasons.push(`connected`);
  return reasons.join(', ') || 'available';
}

export function getRoutingStatistics(decisions: RouteDecision[]): {
  total: number;
  local: number;
  remote: number;
  averageScore: number;
  capabilityDistribution: Record<string, number>;
} {
  const local = decisions.filter(d => d.routeType === 'local').length;
  const remote = decisions.filter(d => d.routeType === 'remote').length;
  const avgScore = decisions.length > 0
    ? Math.round(decisions.reduce((s, d) => s + d.score, 0) / decisions.length)
    : 0;

  const dist: Record<string, number> = {};
  for (const d of decisions) {
    dist[d.capability] = (dist[d.capability] || 0) + 1;
  }

  return { total: decisions.length, local, remote, averageScore, capabilityDistribution: dist };
}
