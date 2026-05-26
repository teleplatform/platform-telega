import type { MeshNodeInfo } from './mesh-node-types.js';

export interface CapabilityCoverage {
  capability: string;
  nodeCount: number;
  totalCapacity: number;
  totalLoad: number;
  coverageScore: number; // 0-100
}

export function renderCapabilityMap(nodes: MeshNodeInfo[]): string {
  const map = new Map<string, { count: number; capacity: number; load: number }>();

  for (const node of nodes) {
    if (node.status !== 'online') continue;
    for (const cap of node.capabilities) {
      const entry = map.get(cap.runtimeCapability) || { count: 0, capacity: 0, load: 0 };
      entry.count++;
      entry.capacity += cap.capacity;
      entry.load += cap.currentLoad;
      map.set(cap.runtimeCapability, entry);
    }
  }

  if (map.size === 0) return 'No capabilities found on online nodes.';

  const lines: string[] = ['Capability Map:'];
  for (const [cap, stats] of map) {
    const loadPct = stats.capacity > 0 ? Math.round((stats.load / stats.capacity) * 100) : 0;
    lines.push(`  ${cap}: ${stats.count} nodes | load ${loadPct}% (${stats.load}/${stats.capacity})`);
  }
  return lines.join('\n');
}

export function renderCapabilityCoverage(nodes: MeshNodeInfo[]): CapabilityCoverage[] {
  const map = new Map<string, { count: number; capacity: number; load: number }>();

  for (const node of nodes) {
    if (node.status !== 'online') continue;
    for (const cap of node.capabilities) {
      const entry = map.get(cap.runtimeCapability) || { count: 0, capacity: 0, load: 0 };
      entry.count++;
      entry.capacity += cap.capacity;
      entry.load += cap.currentLoad;
      map.set(cap.runtimeCapability, entry);
    }
  }

  const result: CapabilityCoverage[] = [];
  for (const [capability, stats] of map) {
    const coverageScore = stats.count > 0 ? Math.min(100, Math.round((stats.count / Math.max(1, nodes.length)) * 100)) : 0;
    result.push({
      capability,
      nodeCount: stats.count,
      totalCapacity: stats.capacity,
      totalLoad: stats.load,
      coverageScore,
    });
  }

  return result.sort((a, b) => b.coverageScore - a.coverageScore);
}

export function renderCapabilityGaps(nodes: MeshNodeInfo[], requiredCapabilities: string[]): string {
  const present = new Set<string>();
  for (const node of nodes) {
    if (node.status === 'online') {
      node.capabilities.forEach(c => present.add(c.runtimeCapability));
    }
  }

  const missing = requiredCapabilities.filter(c => !present.has(c));
  if (missing.length === 0) return 'No capability gaps detected.';

  return `Missing capabilities: ${missing.join(', ')}`;
}
