import type { RuntimeWorker } from './worker-types.js';
import { getOnlineWorkers, getAllWorkers, updateWorkerStatus } from './worker-registry.js';
import { getFederations, getOnlineFederations, updateFederationStatus } from './worker-federation-registry.js';

const REMOTE_HEARTBEAT_INTERVAL_MS = 30000;
const REMOTE_DEAD_AFTER_MS = 120000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let remoteHeartbeatCount = 0;
let remoteFailures = 0;

export interface RemoteHeartbeatStats {
  totalHeartbeats: number;
  failures: number;
  deadRemotes: number;
  aliveRemotes: number;
  lastSweep: number | null;
}

const stats: RemoteHeartbeatStats = {
  totalHeartbeats: 0,
  failures: 0,
  deadRemotes: 0,
  aliveRemotes: 0,
  lastSweep: null
};

export async function pingRemoteWorker(workerId: string): Promise<boolean> {
  try {
    const { getWorker } = await import('./worker-registry.js');
    const worker = getWorker(workerId);
    if (!worker || worker.kind !== 'remote') return false;

    const baseUrl = worker.metadata?.baseUrl as string;
    if (!baseUrl) return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/worker/v1/ping`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

export async function sweepRemoteWorkers(): Promise<{ dead: string[]; alive: string[] }> {
  const dead: string[] = [];
  const alive: string[] = [];

  for (const w of getAllWorkers().filter(w => w.kind === 'remote')) {
    const isAlive = await pingRemoteWorker(w.id);
    if (isAlive) {
      alive.push(w.id);
      updateWorkerStatus(w.id, w.assignedTaskIds.length > 0 ? 'busy' : 'online');
    } else {
      dead.push(w.id);
      updateWorkerStatus(w.id, 'dead');
      remoteFailures++;
    }
  }

  stats.deadRemotes += dead.length;
  stats.aliveRemotes = alive.length;
  stats.lastSweep = Date.now();

  return { dead, alive };
}

export function startRemoteHeartbeatMonitor(intervalMs = REMOTE_HEARTBEAT_INTERVAL_MS): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(async () => {
    remoteHeartbeatCount++;
    await sweepRemoteWorkers();
  }, intervalMs);
}

export function stopRemoteHeartbeatMonitor(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function getRemoteHeartbeatStats(): RemoteHeartbeatStats {
  return { ...stats };
}
