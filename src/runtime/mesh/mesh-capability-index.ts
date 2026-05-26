import type { MeshNodeInfo, MeshNodeCapability, RuntimeCapability, TaskType } from './mesh-node-types.js';

export interface CapabilityIndexEntry {
  capability: RuntimeCapability;
  taskTypes: TaskType[];
  nodes: { nodeId: string; nodeInfo: MeshNodeInfo; capability: MeshNodeCapability; score: number }[];
  totalCapacity: number;
  totalLoad: number;
}

export interface CapabilityIndex {
  entries: Map<RuntimeCapability, CapabilityIndexEntry>;
  lastUpdated: number;
}

export function buildCapabilityIndex(nodes: MeshNodeInfo[]): CapabilityIndex {
  const entries = new Map<RuntimeCapability, CapabilityIndexEntry>();

  for (const node of nodes) {
    if (node.status !== 'online') continue;

    for (const cap of node.capabilities) {
      if (!entries.has(cap.runtimeCapability)) {
        entries.set(cap.runtimeCapability, {
          capability: cap.runtimeCapability,
          taskTypes: new Set(),
          nodes: [],
          totalCapacity: 0,
          totalLoad: 0,
        });
      }

      const entry = entries.get(cap.runtimeCapability)!;
      entry.taskTypes.add(...cap.taskTypes);
      entry.nodes.push({
        nodeId: node.id,
        nodeInfo: node,
        capability: cap,
        score: calculateNodeScore(node, cap),
      });
      entry.totalCapacity += cap.capacity;
      entry.totalLoad += cap.currentLoad;
    }
  }

  // Convert Sets to arrays
  for (const entry of entries.values()) {
    entry.taskTypes = Array.from(entry.taskTypes);
    entry.nodes.sort((a, b) => b.score - a.score);
  }

  return { entries, lastUpdated: Date.now() };
}

function calculateNodeScore(node: MeshNodeInfo, capability: MeshNodeCapability): number {
  const loadFactor = capability.capacity > 0
    ? 1 - (capability.currentLoad / capability.capacity)
    : 0;

  const statusScore = node.status === 'online' ? 1 : 0;
  const uptimeScore = Math.min(node.uptimeMs / (1000 * 60 * 60 * 24), 1);
  const workerScore = node.workerCount > 0 ? 1 : 0.5;

  return (loadFactor * 0.4 + statusScore * 0.3 + uptimeScore * 0.2 + workerScore * 0.1) * 100;
}

export function getNodesForCapability(index: CapabilityIndex, capability: RuntimeCapability): CapabilityIndexEntry | undefined {
  return index.entries.get(capability);
}

export function getNodesForTaskType(index: CapabilityIndex, taskType: TaskType): CapabilityIndexEntry[] {
  const results: CapabilityIndexEntry[] = [];
  for (const entry of index.entries.values()) {
    if (entry.taskTypes.includes(taskType)) {
      results.push(entry);
    }
  }
  return results;
}

export function getBestNodeForCapability(index: CapabilityIndex, capability: RuntimeCapability): { nodeId: string; nodeInfo: MeshNodeInfo; score: number } | null {
  const entry = index.entries.get(capability);
  if (!entry || entry.nodes.length === 0) return null;
  return entry.nodes[0];
}

export function getCapabilityUtilization(index: CapabilityIndex): { capability: RuntimeCapability; utilization: number }[] {
  const results: { capability: RuntimeCapability; utilization: number }[] = [];
  for (const entry of index.entries.values()) {
    const utilization = entry.totalCapacity > 0
      ? Math.round((entry.totalLoad / entry.totalCapacity) * 100)
      : 0;
    results.push({ capability: entry.capability, utilization });
  }
  return results.sort((a, b) => b.utilization - a.utilization);
}
