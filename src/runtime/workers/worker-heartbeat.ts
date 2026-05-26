import type { RuntimeWorker, WorkerHeartbeat } from './worker-types.js';
import { getAllWorkers, updateWorkerHeartbeat, updateWorkerStatus } from './worker-registry.js';

const HEARTBEAT_INTERVAL_MS = 30000;
const DEAD_AFTER_MS = 120000;
const DEGRADED_AFTER_MS = 60000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatCounter = 0;

export interface HeartbeatStats {
  totalHeartbeats: number;
  deadWorkers: number;
  degradedWorkers: number;
  healthyWorkers: number;
  lastSweep: number | null;
}

const stats: HeartbeatStats = {
  totalHeartbeats: 0,
  deadWorkers: 0,
  degradedWorkers: 0,
  healthyWorkers: 0,
  lastSweep: null
};

export function createHeartbeat(workerId: string, activeTasks: number, maxTasks: number, errorsSinceLast: number): WorkerHeartbeat {
  const load = maxTasks > 0 ? activeTasks / maxTasks : 0;
  const status = activeTasks >= maxTasks ? 'busy' : 'online';
  return {
    workerId,
    status,
    timestamp: Date.now(),
    load,
    activeTasks,
    maxTasks,
    errorsSinceLast
  };
}

export function recordHeartbeat(workerId: string, activeTasks: number, maxTasks: number, errorsSinceLast: number): boolean {
  const hb = createHeartbeat(workerId, activeTasks, maxTasks, errorsSinceLast);
  stats.totalHeartbeats++;
  return updateWorkerHeartbeat(workerId, hb);
}

export function sweepDeadWorkers(): { dead: string[]; degraded: string[] } {
  const now = Date.now();
  const dead: string[] = [];
  const degraded: string[] = [];

  for (const w of getAllWorkers()) {
    const elapsed = now - w.lastSeen;
    if (w.status !== 'dead' && elapsed > DEAD_AFTER_MS) {
      updateWorkerStatus(w.id, 'dead');
      dead.push(w.id);
    } else if (w.status === 'online' && elapsed > DEGRADED_AFTER_MS) {
      updateWorkerStatus(w.id, 'degraded');
      degraded.push(w.id);
    }
  }

  stats.deadWorkers += dead.length;
  stats.degradedWorkers += degraded.length;
  stats.healthyWorkers = getAllWorkers().filter(w => w.status === 'online' || w.status === 'busy').length;
  stats.lastSweep = now;

  return { dead, degraded };
}

export function startHeartbeatMonitor(intervalMs = HEARTBEAT_INTERVAL_MS): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    sweepDeadWorkers();
  }, intervalMs);
}

export function stopHeartbeatMonitor(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function getHeartbeatStats(): HeartbeatStats {
  return { ...stats };
}

export function isWorkerHealthy(workerId: string): boolean {
  const { getWorker } = require('./worker-registry.js');
  const w = getWorker(workerId);
  if (!w) return false;
  return w.status !== 'dead' && w.status !== 'offline';
}
