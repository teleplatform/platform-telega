import type { RuntimeWorker, WorkerAssignment } from './worker-types.js';
import { getAllWorkers, getWorker } from './worker-registry.js';
import { getAssignmentsByWorker } from './worker-assignment.js';
import { appendEvidenceRecord } from '../evidence/execution-evidence-store.js';
import { hashTraceId } from '../evidence/execution-hash.js';

export interface ContractEvidenceBundle {
  contractId: string;
  workerId: string;
  workerName: string;
  assignments: Array<{
    assignmentId: string;
    nodeId: string;
    taskType: string;
    status: string;
    evidenceRefs: string[];
    error: string | null;
  }>;
  totalEvidenceRefs: number;
  failedAssignments: number;
  completedAssignments: number;
}

export function bindWorkerToContract(contractId: string, workerId: string): boolean {
  const worker = getWorker(workerId);
  if (!worker) return false;

  worker.metadata.contractId = contractId;

  appendEvidenceRecord({
    evidence_id: hashTraceId(contractId, 'worker_contract_bound'),
    trace_id: contractId,
    job_id: workerId,
    type: 'execution_started',
    timestamp: new Date().toISOString(),
    payload: {
      contractId,
      workerId: worker.id,
      workerName: worker.name,
      action: 'contract_bound'
    }
  });

  return true;
}

export function getWorkerEvidenceBundle(workerId: string): ContractEvidenceBundle {
  const worker = getWorker(workerId);
  const assignments = getAssignmentsByWorker(workerId);

  return {
    contractId: worker?.metadata?.contractId as string ?? '(unbound)',
    workerId,
    workerName: worker?.name ?? '(unknown)',
    assignments: assignments.map(a => ({
      assignmentId: a.id,
      nodeId: a.nodeId,
      taskType: a.taskType,
      status: a.status,
      evidenceRefs: a.evidenceRefs,
      error: a.error
    })),
    totalEvidenceRefs: assignments.reduce((s, a) => s + a.evidenceRefs.length, 0),
    failedAssignments: assignments.filter(a => a.status === 'failed').length,
    completedAssignments: assignments.filter(a => a.status === 'completed').length
  };
}

export function getContractEvidenceBundle(contractId: string): ContractEvidenceBundle[] {
  const contractWorkers = getAllWorkers().filter(w => w.metadata?.contractId === contractId);
  return contractWorkers.map(w => getWorkerEvidenceBundle(w.id));
}

export function evidenceLinkageSummary(): string {
  const all = getAllWorkers();
  const totalRefs = all.reduce((sum, w) => {
    return sum + getAssignmentsByWorker(w.id).reduce((s, a) => s + a.evidenceRefs.length, 0);
  }, 0);
  const totalAssignments = all.reduce((sum, w) => sum + getAssignmentsByWorker(w.id).length, 0);
  return `Evidence linkage: ${totalAssignments} assignments, ${totalRefs} evidence refs across ${all.length} workers`;
}
