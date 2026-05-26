import type { RuntimeWorker } from './worker-types.js';
import type { TaskType, RuntimeCapability } from '../sigma-forge/sigma-forge-types.js';
import { registerRemoteWorker } from './remote-worker-adapter.js';
import type { RemoteWorkerRegistration } from './remote-worker-adapter.js';
import { performHandshake } from './worker-auth.js';
import { getAllWorkers, getWorkersByCapability, getOnlineWorkers } from './worker-registry.js';
import { appendEvidenceRecord } from '../evidence/execution-evidence-store.js';
import { hashTraceId } from '../evidence/execution-hash.js';

export type FederationStatus = 'online' | 'offline' | 'degraded' | 'handshake_failed';

export interface FederatedRuntime {
  id: string;
  name: string;
  baseUrl: string;
  status: FederationStatus;
  capabilities: string[];
  remoteWorkers: string[];
  version: string;
  lastSeen: number;
  registeredAt: number;
  metadata: Record<string, unknown>;
}

const federations = new Map<string, FederatedRuntime>();

let fedCounter = 0;

function generateFederationId(): string {
  return `fed_${Date.now()}_${String(++fedCounter).padStart(4, '0')}`;
}

export function registerFederation(name: string, baseUrl: string, capabilities: string[], version: string): FederatedRuntime {
  const id = generateFederationId();
  const runtime: FederatedRuntime = {
    id, name, baseUrl,
    status: 'online',
    capabilities,
    remoteWorkers: [],
    version,
    lastSeen: Date.now(),
    registeredAt: Date.now(),
    metadata: {}
  };
  federations.set(id, runtime);
  return runtime;
}

export function unregisterFederation(federationId: string): boolean {
  return federations.delete(federationId);
}

export function getFederation(federationId: string): FederatedRuntime | undefined {
  return federations.get(federationId);
}

export function getAllFederations(): FederatedRuntime[] {
  return [...federations.values()];
}

export function getOnlineFederations(): FederatedRuntime[] {
  return [...federations.values()].filter(f => f.status === 'online');
}

export function updateFederationStatus(federationId: string, status: FederationStatus): boolean {
  const f = federations.get(federationId);
  if (!f) return false;
  f.status = status;
  f.lastSeen = Date.now();
  return true;
}

export async function federateWithRemote(
  name: string,
  baseUrl: string,
  localRuntimeId: string,
  localCapabilities: string[],
  localVersion: string,
  remoteWorkerRegistrations?: RemoteWorkerRegistration[]
): Promise<{ federation: FederatedRuntime; workers: RuntimeWorker[] } | { error: string }> {
  const handshake = await performHandshake(baseUrl, localRuntimeId, localCapabilities, localVersion);

  if (!handshake.ok) {
    return { error: `Handshake failed: ${handshake.error}` };
  }

  const federation = registerFederation(
    name,
    baseUrl,
    handshake.remoteCapabilities,
    handshake.remoteVersion
  );

  const workers: RuntimeWorker[] = [];

  if (remoteWorkerRegistrations) {
    for (const reg of remoteWorkerRegistrations) {
      const worker = registerRemoteWorker(reg);
      workers.push(worker);
      federation.remoteWorkers.push(worker.id);
    }
  }

  appendEvidenceRecord({
    evidence_id: hashTraceId(federation.id, 'federation_established'),
    trace_id: federation.id,
    job_id: 'federation',
    type: 'execution_started',
    timestamp: new Date().toISOString(),
    payload: {
      federationId: federation.id,
      name,
      baseUrl,
      remoteWorkers: workers.length,
      remoteCapabilities: handshake.remoteCapabilities
    }
  });

  return { federation, workers };
}

export function discoverFederatedWorkers(taskType: TaskType): { worker: RuntimeWorker; federation: FederatedRuntime }[] {
  const results: { worker: RuntimeWorker; federation: FederatedRuntime }[] = [];
  const remoteWorkers = getWorkersByCapability(taskType).filter(w => w.kind === 'remote');

  for (const w of remoteWorkers) {
    const fed = [...federations.values()].find(f => f.remoteWorkers.includes(w.id));
    if (fed && fed.status === 'online') {
      results.push({ worker: w, federation: fed });
    }
  }

  return results;
}

export function federatedSummary(): string {
  const all = getAllFederations();
  const online = all.filter(f => f.status === 'online').length;
  const totalWorkers = all.reduce((s, f) => s + f.remoteWorkers.length, 0);
  return `Federation: ${all.length} runtimes (${online} online), ${totalWorkers} remote workers`;
}

export function getFederatedWorkerCount(): number {
  return getAllWorkers().filter(w => w.kind === 'remote').length;
}
