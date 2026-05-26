import type { MeshHealthEntry, MeshHealthMap } from './mesh-node-types.js';
import { getAllMeshNodes, getMeshNodeCountByStatus } from './runtime-node-registry.js';
import { pingMeshNode, getMeshHeartbeatStats } from './mesh-heartbeat.js';

export function buildMeshHealthMap(): MeshHealthMap {
  const nodes = getAllMeshNodes();
  const counts = getMeshNodeCountByStatus();

  const entries: MeshHealthEntry[] = nodes.map(n => {
    const avgLoad = n.capabilities.length > 0
      ? n.capabilities.reduce((s, c) => s + c.currentLoad / Math.max(1, c.capacity), 0) / n.capabilities.length
      : 0;

    const totalWorkers = n.workerCount;
    const activeCaps = n.capabilities.filter(c => c.currentLoad > 0).length;

    return {
      nodeId: n.id,
      name: n.name,
      kind: n.kind,
      status: n.status,
      address: n.address,
      lastSeen: n.lastSeen,
      latencyMs: n.connections.reduce((s, c) => Math.max(s, c.latencyMs), 0),
      load: avgLoad,
      workerCount: totalWorkers,
      activeAssignments: activeCaps,
      uptimeMs: n.registeredAt > 0 ? Date.now() - n.registeredAt : 0,
      lastHeartbeatAt: n.lastSeen,
    };
  });

  const onlineNodes = entries.filter(e => e.status === 'online');
  const avgLatency = onlineNodes.length > 0
    ? onlineNodes.reduce((s, e) => s + e.latencyMs, 0) / onlineNodes.length
    : 0;

  return {
    totalNodes: nodes.length,
    online: counts['online'] || 0,
    offline: counts['offline'] || 0,
    degraded: counts['degraded'] || 0,
    draining: counts['draining'] || 0,
    dead: counts['dead'] || 0,
    entries,
    generatedAt: new Date().toISOString(),
    averageLatencyMs: Math.round(avgLatency),
    totalWorkers: entries.reduce((s, e) => s + e.workerCount, 0),
    totalAssignments: entries.reduce((s, e) => s + e.activeAssignments, 0),
  };
}

export async function buildLiveMeshHealthMap(): Promise<MeshHealthMap> {
  const base = buildMeshHealthMap();

  const liveEntries: MeshHealthEntry[] = [];
  for (const entry of base.entries) {
    if (entry.status === 'dead' || entry.status === 'offline') {
      liveEntries.push(entry);
      continue;
    }

    try {
      const result = await pingMeshNode(entry.nodeId);
      liveEntries.push({
        ...entry,
        status: result.ok ? result.status : 'offline',
        latencyMs: result.latencyMs,
        lastHeartbeatAt: Date.now(),
      });
    } catch {
      liveEntries.push({ ...entry, status: 'offline' });
    }
  }

  const online = liveEntries.filter(e => e.status === 'online').length;
  const avgLatency = liveEntries.filter(e => e.status === 'online').reduce((s, e) => s + e.latencyMs, 0) / Math.max(1, online);

  return {
    totalNodes: base.totalNodes,
    online, offline: liveEntries.filter(e => e.status === 'offline').length,
    degraded: liveEntries.filter(e => e.status === 'degraded').length,
    draining: liveEntries.filter(e => e.status === 'draining').length,
    dead: liveEntries.filter(e => e.status === 'dead').length,
    entries: liveEntries,
    generatedAt: new Date().toISOString(),
    averageLatencyMs: Math.round(avgLatency),
    totalWorkers: liveEntries.reduce((s, e) => s + e.workerCount, 0),
    totalAssignments: liveEntries.reduce((s, e) => s + e.activeAssignments, 0),
  };
}

export function renderMeshHealthStatus(): string {
  const map = buildMeshHealthMap();

  const lines: string[] = [];
  lines.push(`╔══ Mesh Health Map ═══════════════════`);
  lines.push(`║ Nodes: ${map.totalNodes} (online=${map.online}, degraded=${map.degraded}, offline=${map.offline}, dead=${map.dead})`);
  lines.push(`║ Workers: ${map.totalWorkers} | Assignments: ${map.totalAssignments}`);
  lines.push(`║ Avg latency: ${map.averageLatencyMs}ms`);
  lines.push(`║ Generated: ${map.generatedAt}`);
  lines.push(`╠══ Node Details ═════════════════════`);

  for (const entry of map.entries) {
    const icon = entry.status === 'online' ? '🟢' : entry.status === 'degraded' ? '🟡' : entry.status === 'draining' ? '🔵' : '🔴';
    lines.push(`║ ${icon} ${entry.name} (${entry.nodeId.slice(0, 12)}...)`);
    lines.push(`║   Status: ${entry.status} | Load: ${(entry.load * 100).toFixed(0)}%`);
    lines.push(`║   Workers: ${entry.workerCount} | Assignments: ${entry.activeAssignments}`);
    lines.push(`║   Latency: ${entry.latencyMs}ms | Uptime: ${formatUptime(entry.uptimeMs)}`);
    lines.push(`║   Address: ${entry.address}`);
  }

  lines.push(`╚══════════════════════════════════════`);
  return lines.join('\n');
}

function formatUptime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ${hr % 24}h`;
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

export function renderMeshNodeCompact(nodeId: string): string {
  const map = buildMeshHealthMap();
  const entry = map.entries.find(e => e.nodeId === nodeId);
  if (!entry) return `Node ${nodeId} not found in mesh health map`;

  const icon = entry.status === 'online' ? '🟢' : entry.status === 'degraded' ? '🟡' : entry.status === 'draining' ? '🔵' : '🔴';
  return `${icon} ${entry.name} | ${entry.status} | load ${(entry.load * 100).toFixed(0)}% | ${entry.workerCount} workers | ${entry.latencyMs}ms`;
}
