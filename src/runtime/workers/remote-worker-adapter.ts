import type { RuntimeWorker, WorkerCapability } from './worker-types.js';
import type { TaskType, RuntimeCapability } from '../sigma-forge/sigma-forge-types.js';
import { registerWorker, updateWorkerHeartbeat, updateWorkerStatus } from './worker-registry.js';
import { createHeartbeat } from './worker-heartbeat.js';
import { sendExecuteRequest, sendHeartbeatRequest, sendEvidenceRequest, createTransportConfig } from './remote-worker-transport.js';
import type { RemoteTransportConfig } from './remote-worker-transport.js';

export interface RemoteWorkerRegistration {
  name: string;
  baseUrl: string;
  authToken: string;
  capabilities: WorkerCapability[];
  transportConfig?: Partial<RemoteTransportConfig>;
}

export function registerRemoteWorker(registration: RemoteWorkerRegistration): RuntimeWorker {
  const config = createTransportConfig(
    registration.baseUrl,
    registration.authToken,
    { timeoutMs: 30000, retryCount: 2, ...registration.transportConfig }
  );

  const worker = registerWorker(registration.name, 'remote', registration.capabilities, {
    baseUrl: registration.baseUrl,
    remote: true,
    config
  });

  // Register all task types this remote worker supports
  const taskTypes = registration.capabilities.flatMap(c => c.taskTypes);

  // Initial heartbeat
  performRemoteHeartbeat(worker.id, config).catch(() => {});

  return worker;
}

export async function executeOnRemoteWorker(
  workerId: string,
  nodeId: string,
  taskType: string,
  capability: string,
  params: Record<string, unknown>,
  contractId: string | null
): Promise<{ ok: boolean; output: unknown; evidence: string | null; durationMs: number; error: string | null }> {
  const { getWorker } = await import('./worker-registry.js');
  const worker = getWorker(workerId);
  if (!worker) return { ok: false, output: null, evidence: null, durationMs: 0, error: 'Worker not found' };

  const config = worker.metadata?.config as RemoteTransportConfig | undefined;
  if (!config) return { ok: false, output: null, evidence: null, durationMs: 0, error: 'No transport config' };

  try {
    const response = await sendExecuteRequest(config, {
      workerId,
      nodeId,
      taskType,
      capability,
      params,
      contractId,
      authToken: config.authToken
    });

    if (response.ok) {
      await performRemoteHeartbeat(workerId, config);
    }

    return response;
  } catch (err: any) {
    return { ok: false, output: null, evidence: null, durationMs: 0, error: err.message };
  }
}

export async function performRemoteHeartbeat(workerId: string, config: RemoteTransportConfig): Promise<void> {
  try {
    const { getWorker } = await import('./worker-registry.js');
    const worker = getWorker(workerId);
    if (!worker) return;

    const hb = createHeartbeat(workerId, worker.assignedTaskIds.length, 5, 0);
    const response = await sendHeartbeatRequest(config, {
      workerId,
      authToken: config.authToken,
      activeTasks: hb.activeTasks,
      maxTasks: hb.maxTasks,
      errorsSinceLast: hb.errorsSinceLast
    });

    if (response.ok) {
      updateWorkerHeartbeat(workerId, hb);
    }

    if (response.status === 'offline' || response.status === 'dead') {
      updateWorkerStatus(workerId, response.status as any);
    }
  } catch {}
}

export function getRemoteWorkerUrl(workerId: string): string | null {
  const { getWorker } = require('./worker-registry.js');
  const worker = getWorker(workerId);
  if (!worker || worker.kind !== 'remote') return null;
  return (worker.metadata?.baseUrl as string) ?? null;
}
