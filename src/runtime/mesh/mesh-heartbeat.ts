import type { MeshNodeInfo, MeshNodeStatus, MeshNodeHeartbeat } from './mesh-node-types.js';
import { getMeshNode, getAllMeshNodes, updateMeshNodeStatus } from './runtime-node-registry.js';
import { generateAuthToken } from '../workers/worker-auth.js';
import { appendAuditEvent } from '../audit/audit-store.js';

const MESH_HEARTBEAT_INTERVAL_MS = 30000;
const MESH_DEAD_AFTER_MS = 120000;
const MESH_DEGRADED_AFTER_MS = 60000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export interface MeshHeartbeatStats {
  totalHeartbeats: number;
  failures: number;
  deadNodes: number;
  degradedNodes: number;
  healthyNodes: number;
  lastSweep: number | null;
}

const stats: MeshHeartbeatStats = {
  totalHeartbeats: 0,
  failures: 0,
  deadNodes: 0,
  degradedNodes: 0,
  healthyNodes: 0,
  lastSweep: null,
};

export async function pingMeshNode(nodeId: string): Promise<{ ok: boolean; latencyMs: number; status: MeshNodeStatus }> {
  const node = getMeshNode(nodeId);
  if (!node) {
    return { ok: false, latencyMs: 0, status: 'dead' };
  }

  const startTime = Date.now();
  const token = generateAuthToken({ nodeId, _ts: startTime, action: 'mesh_ping' });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const url = `${node.address.replace(/\/$/, '')}/mesh/v1/ping`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Node-Id': nodeId,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    stats.totalHeartbeats++;

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const status: MeshNodeStatus = data.status || 'online';
      return { ok: true, latencyMs, status };
    }

    stats.failures++;
    return { ok: false, latencyMs, status: 'offline' };
  } catch {
    stats.failures++;
    return { ok: false, latencyMs: Date.now() - startTime, status: 'offline' };
  }
}

export function sweepDeadMeshNodes(): { dead: string[]; degraded: string[] } {
  const now = Date.now();
  const dead: string[] = [];
  const degraded: string[] = [];

  for (const n of getAllMeshNodes()) {
    const elapsed = now - n.lastSeen;

    if (n.status !== 'dead' && elapsed > MESH_DEAD_AFTER_MS) {
      updateMeshNodeStatus(n.id, 'dead');
      dead.push(n.id);

      appendAuditEvent({
        kind: 'worker.degraded',
        severity: 'high',
        timestamp: new Date().toISOString(),
        traceId: n.id,
        source: 'mesh-heartbeat',
        actor: n.id,
        summary: `Mesh node DEAD: ${n.name} (${n.id}) — no heartbeat for ${elapsed}ms`,
        payload: { nodeId: n.id, name: n.name, elapsedMs: elapsed, thresholdMs: MESH_DEAD_AFTER_MS },
      });
    } else if (n.status === 'online' && elapsed > MESH_DEGRADED_AFTER_MS) {
      updateMeshNodeStatus(n.id, 'degraded');
      degraded.push(n.id);

      appendAuditEvent({
        kind: 'worker.degraded',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        traceId: n.id,
        source: 'mesh-heartbeat',
        actor: n.id,
        summary: `Mesh node degraded: ${n.name} — stale for ${elapsed}ms`,
        payload: { nodeId: n.id, name: n.name, elapsedMs: elapsed },
      });
    }
  }

  stats.deadNodes += dead.length;
  stats.degradedNodes += degraded.length;
  stats.healthyNodes = getAllMeshNodes().filter(n => n.status === 'online').length;
  stats.lastSweep = now;

  return { dead, degraded };
}

export async function pingAllMeshNodes(): Promise<{ alive: string[]; dead: string[] }> {
  const alive: string[] = [];
  const dead: string[] = [];

  for (const n of getAllMeshNodes().filter(n => n.status !== 'dead')) {
    const result = await pingMeshNode(n.id);
    if (result.ok) {
      alive.push(n.id);
    } else {
      dead.push(n.id);
      updateMeshNodeStatus(n.id, 'offline');
    }
  }

  return { alive, dead };
}

export function startMeshHeartbeatMonitor(intervalMs = MESH_HEARTBEAT_INTERVAL_MS): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    sweepDeadMeshNodes();
  }, intervalMs);
}

export function stopMeshHeartbeatMonitor(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function getMeshHeartbeatStats(): MeshHeartbeatStats {
  return { ...stats };
}

export function isMeshNodeHealthy(nodeId: string): boolean {
  const n = getMeshNode(nodeId);
  if (!n) return false;
  return n.status !== 'dead' && n.status !== 'offline';
}

export function meshHeartbeatSummary(): string {
  const s = getMeshHeartbeatStats();
  return `Mesh heartbeat: ${s.totalHeartbeats} pings, ${s.failures} failures, ${s.healthyNodes} healthy, ${s.deadNodes} dead, ${s.degradedNodes} degraded`;
}
