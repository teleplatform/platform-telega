import type { RuntimeWorker, WorkerStatus, WorkerCapability, WorkerHeartbeat } from './worker-types.js';
import type { TaskType, RuntimeCapability } from '../sigma-forge/sigma-forge-types.js';

const workers = new Map<string, RuntimeWorker>();

let workerCounter = 0;

function generateWorkerId(prefix: string): string {
  return `${prefix}_${Date.now()}_${String(++workerCounter).padStart(4, '0')}`;
}

export function registerWorker(name: string, kind: 'local' | 'remote' | 'specialized', capabilities: WorkerCapability[], metadata?: Record<string, unknown>): RuntimeWorker {
  const id = generateWorkerId(kind === 'local' ? 'w' : 'wr');
  const worker: RuntimeWorker = {
    id,
    name,
    kind,
    status: 'online',
    capabilities,
    heartbeat: null,
    assignedTaskIds: [],
    lastSeen: Date.now(),
    registeredAt: Date.now(),
    metadata: metadata ?? {}
  };
  workers.set(id, worker);
  return worker;
}

export function unregisterWorker(workerId: string): boolean {
  return workers.delete(workerId);
}

export function getWorker(workerId: string): RuntimeWorker | undefined {
  return workers.get(workerId);
}

export function getAllWorkers(): RuntimeWorker[] {
  return [...workers.values()];
}

export function getWorkersByCapability(taskType: TaskType): RuntimeWorker[] {
  return [...workers.values()].filter(w =>
    w.capabilities.some(c => c.taskTypes.includes(taskType))
  );
}

export function getWorkersByKind(kind: string): RuntimeWorker[] {
  return [...workers.values()].filter(w => w.kind === kind);
}

export function getOnlineWorkers(): RuntimeWorker[] {
  return [...workers.values()].filter(w => w.status === 'online' || w.status === 'busy');
}

export function updateWorkerStatus(workerId: string, status: WorkerStatus): boolean {
  const w = workers.get(workerId);
  if (!w) return false;
  w.status = status;
  w.lastSeen = Date.now();
  return true;
}

export function updateWorkerHeartbeat(workerId: string, heartbeat: WorkerHeartbeat): boolean {
  const w = workers.get(workerId);
  if (!w) return false;
  w.heartbeat = heartbeat;
  w.lastSeen = Date.now();
  w.status = heartbeat.status;
  return true;
}

export function assignTaskToWorker(workerId: string, taskId: string): boolean {
  const w = workers.get(workerId);
  if (!w) return false;
  w.assignedTaskIds.push(taskId);
  w.lastSeen = Date.now();
  return true;
}

export function unassignTaskFromWorker(workerId: string, taskId: string): boolean {
  const w = workers.get(workerId);
  if (!w) return false;
  w.assignedTaskIds = w.assignedTaskIds.filter(id => id !== taskId);
  return true;
}

export function getWorkerCountByStatus(status: WorkerStatus): number {
  return [...workers.values()].filter(w => w.status === status).length;
}

export function workerRegistrySummary(): string {
  const all = getAllWorkers();
  const online = getWorkerCountByStatus('online');
  const busy = getWorkerCountByStatus('busy');
  const dead = getWorkerCountByStatus('dead');
  const local = getWorkersByKind('local').length;
  const remote = getWorkersByKind('remote').length;
  const totalTasks = all.reduce((sum, w) => sum + w.assignedTaskIds.length, 0);
  return `Workers: ${all.length} (online=${online}, busy=${busy}, dead=${dead}, local=${local}, remote=${remote}, tasks=${totalTasks})`;
}
