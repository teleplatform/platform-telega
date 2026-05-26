import type { TaskType } from '../sigma-forge/sigma-forge-types.js';
import { getAllWorkers } from './worker-registry.js';
import { getAssignmentsByWorker } from './worker-assignment.js';

export interface RemoteTraceRequest {
  workerId: string;
  nodeId: string;
  contractId?: string;
}

export interface RemoteTraceResponse {
  ok: boolean;
  trace: Array<{
    nodeId: string;
    taskType: string;
    status: string;
    durationMs: number;
    evidence: string | null;
    error: string | null;
    timestamp: number;
  }>;
  error?: string;
}

export async function requestRemoteReplay(workerId: string, nodeId: string, contractId?: string): Promise<RemoteTraceResponse> {
  const { getWorker } = await import('./worker-registry.js');
  const worker = getWorker(workerId);
  if (!worker || worker.kind !== 'remote') {
    return { ok: false, trace: [], error: 'Worker not found or not remote' };
  }

  const baseUrl = worker.metadata?.baseUrl as string;
  if (!baseUrl) return { ok: false, trace: [], error: 'No base URL for remote worker' };

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/worker/v1/trace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, nodeId, contractId })
    });

    if (!response.ok) {
      return { ok: false, trace: [], error: `HTTP ${response.status}` };
    }

    return await response.json();
  } catch (err: any) {
    return { ok: false, trace: [], error: err.message };
  }
}

export async function fetchRemoteEvidence(workerId: string, assignmentId: string): Promise<{ ok: boolean; evidence: unknown; error?: string }> {
  const { getWorker } = await import('./worker-registry.js');
  const worker = getWorker(workerId);
  if (!worker || worker.kind !== 'remote') {
    return { ok: false, evidence: null, error: 'Worker not found or not remote' };
  }

  const baseUrl = worker.metadata?.baseUrl as string;
  if (!baseUrl) return { ok: false, evidence: null, error: 'No base URL' };

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/worker/v1/evidence/${encodeURIComponent(assignmentId)}`,
      { method: 'GET' }
    );

    if (!response.ok) return { ok: false, evidence: null, error: `HTTP ${response.status}` };
    const data = await response.json();
    return { ok: true, evidence: data };
  } catch (err: any) {
    return { ok: false, evidence: null, error: err.message };
  }
}

export async function mergeRemoteTraces(workerIds: string[], contractId?: string): Promise<{ ok: boolean; merged: RemoteTraceResponse['trace']; errors: string[] }> {
  const merged: RemoteTraceResponse['trace'] = [];
  const errors: string[] = [];

  for (const wid of workerIds) {
    try {
      const result = await requestRemoteReplay(wid, '', contractId);
      if (result.ok) {
        merged.push(...result.trace);
      } else {
        errors.push(`Worker ${wid}: ${result.error}`);
      }
    } catch (err: any) {
      errors.push(`Worker ${wid}: ${err.message}`);
    }
  }

  // Add local traces
  for (const w of getAllWorkers().filter(w => w.kind === 'local')) {
    const assignments = getAssignmentsByWorker(w.id);
    for (const a of assignments) {
      merged.push({
        nodeId: a.nodeId,
        taskType: a.taskType,
        status: a.status,
        durationMs: a.durationMs ?? 0,
        evidence: a.evidenceRefs[0] ?? null,
        error: a.error,
        timestamp: a.assignedAt
      });
    }
  }

  return { ok: errors.length === 0, merged, errors };
}
