import type { WorkerAssignment, RuntimeWorker } from './worker-types.js';
import { assignNodeToWorker, updateAssignmentStatus, getAssignmentsByWorker } from './worker-assignment.js';
import { getWorker, getAllWorkers, updateWorkerStatus } from './worker-registry.js';
import { appendEvidenceRecord } from '../evidence/execution-evidence-store.js';
import { hashTraceId } from '../evidence/execution-hash.js';

export interface RecoveryResult {
  reassigned: number;
  failed: number;
  details: Array<{ assignmentId: string; nodeId: string; status: string }>;
}

export function recoverTasksFromDeadWorker(workerId: string): RecoveryResult {
  const worker = getWorker(workerId);
  if (!worker) return { reassigned: 0, failed: 0, details: [] };

  const pendingAssignments = getAssignmentsByWorker(workerId)
    .filter(a => a.status === 'pending' || a.status === 'running');

  const result: RecoveryResult = { reassigned: 0, failed: 0, details: [] };

  for (const assignment of pendingAssignments) {
    const reassignResult = assignNodeToWorker({
      graphId: assignment.graphId,
      nodeId: assignment.nodeId,
      taskType: assignment.taskType,
      capability: assignment.taskType.includes('.') ? assignment.taskType.split('.')[0] as any : 'execution'
    });

    if ('error' in reassignResult) {
      updateAssignmentStatus(assignment.id, 'failed', { error: reassignResult.error });
      result.failed++;
      result.details.push({ assignmentId: assignment.id, nodeId: assignment.nodeId, status: 'failed' });
    } else {
      updateAssignmentStatus(assignment.id, 'reassigned');
      result.reassigned++;
      result.details.push({
        assignmentId: assignment.id,
        nodeId: assignment.nodeId,
        status: `reassigned to ${reassignResult.worker.id}`
      });
    }
  }

  return result;
}

export function recoverAllDeadWorkers(): RecoveryResult {
  const deadWorkers = getAllWorkers().filter(w => w.status === 'dead');
  let total: RecoveryResult = { reassigned: 0, failed: 0, details: [] };

  for (const w of deadWorkers) {
    const r = recoverTasksFromDeadWorker(w.id);
    total.reassigned += r.reassigned;
    total.failed += r.failed;
    total.details = total.details.concat(r.details);
  }

  if (total.reassigned > 0 || total.failed > 0) {
    appendEvidenceRecord({
      evidence_id: hashTraceId('recovery', 'worker_recovery_completed'),
      trace_id: 'worker_recovery',
      job_id: 'worker_failure_recovery',
      type: 'execution_completed',
      timestamp: new Date().toISOString(),
      payload: { ...total }
    });
  }

  return total;
}
