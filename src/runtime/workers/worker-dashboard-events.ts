import { emitMissionControlLiveEvent } from '../hooks/mission-control-live-feed-hook.js';
import { appendEvidenceRecord } from '../evidence/execution-evidence-store.js';
import { hashTraceId } from '../evidence/execution-hash.js';
import type { RuntimeWorker, WorkerAssignment } from './worker-types.js';
import { getAllWorkers, getWorker } from './worker-registry.js';
import { getAssignmentsByGraph } from './worker-assignment.js';
import { getHeartbeatStats } from './worker-heartbeat.js';

export function emitWorkerRegistered(worker: RuntimeWorker): void {
  emitMissionControlLiveEvent({
    kind: 'execution_started',
    severity: 'info',
    title: `Worker registered: ${worker.name} (${worker.kind})`,
    trace_id: worker.id,
    payload: { workerId: worker.id, name: worker.name, kind: worker.kind, capabilities: worker.capabilities.map(c => c.runtimeCapability) }
  });
}

export function emitWorkerHeartbeatEvent(workerId: string, status: string, activeTasks: number): void {
  emitMissionControlLiveEvent({
    kind: 'execution_completed',
    severity: 'low',
    title: `Worker heartbeat: ${workerId} (${status}, ${activeTasks} tasks)`,
    trace_id: workerId,
    payload: { workerId, status, activeTasks }
  });
}

export function emitWorkerDead(workerId: string): void {
  const worker = getWorker(workerId);
  emitMissionControlLiveEvent({
    kind: 'execution_failed',
    severity: 'high',
    title: `Worker DEAD: ${worker?.name ?? workerId}`,
    trace_id: workerId,
    payload: { workerId, name: worker?.name }
  });
}

export function emitWorkerAssignmentEvent(assignmentId: string, workerId: string, graphId: string, nodeId: string, status: string): void {
  const kind = status === 'completed' ? 'execution_completed' : status === 'failed' ? 'execution_failed' : 'execution_started';
  const sev = status === 'failed' ? 'high' : 'info';

  emitMissionControlLiveEvent({
    kind: kind as any,
    severity: sev as any,
    title: `Worker assignment: ${assignmentId} → ${status}`,
    trace_id: graphId,
    payload: { assignmentId, workerId, graphId, nodeId, status }
  });
}

export async function emitWorkerDashboardSnapshot(graphId: string): Promise<void> {
  const workers = getAllWorkers();
  const assignments = getAssignmentsByGraph(graphId);
  const heartbeatStats = getHeartbeatStats();

  const snapshot = {
    workers: workers.length,
    online: workers.filter(w => w.status === 'online').length,
    busy: workers.filter(w => w.status === 'busy').length,
    dead: workers.filter(w => w.status === 'dead').length,
    assignments: assignments.length,
    completedAssignments: assignments.filter(a => a.status === 'completed').length,
    failedAssignments: assignments.filter(a => a.status === 'failed').length,
    heartbeatStats
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(graphId, 'worker_dashboard_snapshot'),
    trace_id: graphId,
    job_id: 'worker_dashboard',
    type: 'artifact_emitted',
    timestamp: new Date().toISOString(),
    payload: snapshot
  });
}

export async function emitWorkerContractBound(contractId: string, workerId: string, graphId: string): Promise<void> {
  const worker = getWorker(workerId);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(contractId, 'worker_contract_bound'),
    trace_id: graphId,
    job_id: workerId,
    type: 'execution_started',
    timestamp: new Date().toISOString(),
    payload: { contractId, workerId, workerName: worker?.name, graphId }
  });
}
