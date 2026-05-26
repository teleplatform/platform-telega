import type { RuntimeContract } from '../sigma-forge/sigma-forge-types.js';
import { getAllWorkers } from './worker-registry.js';
import { getAssignmentsByWorker } from './worker-assignment.js';
import { getAllFederations } from './worker-federation-registry.js';
import { appendEvidenceRecord } from '../evidence/execution-evidence-store.js';
import { hashTraceId } from '../evidence/execution-hash.js';

export interface CrossRuntimeContract {
  contractId: string;
  intent: string;
  localRuntimeId: string;
  remoteRuntimes: Array<{
    runtimeId: string;
    runtimeName: string;
    baseUrl: string;
    workers: string[];
    assignments: number;
  }>;
  totalAssignments: number;
  totalEvidenceRefs: number;
  status: 'active' | 'completed' | 'failed';
  createdAt: number;
}

const crossContracts = new Map<string, CrossRuntimeContract>();

export function createCrossRuntimeContract(
  contract: RuntimeContract,
  localRuntimeId: string,
  federationIds: string[]
): CrossRuntimeContract {
  const federations = getAllFederations();
  const selectedFeds = federations.filter(f => federationIds.includes(f.id));

  const remoteRuntimes = selectedFeds.map(fed => {
    const workers = fed.remoteWorkers.map(wid => getAllWorkers().find(w => w.id === wid)).filter(Boolean);
    const assignments = workers.reduce((s, w) => s + getAssignmentsByWorker(w!.id).length, 0);
    return {
      runtimeId: fed.id,
      runtimeName: fed.name,
      baseUrl: fed.baseUrl,
      workers: workers.map(w => w!.id),
      assignments
    };
  });

  const crossContract: CrossRuntimeContract = {
    contractId: contract.id,
    intent: contract.intent,
    localRuntimeId,
    remoteRuntimes,
    totalAssignments: remoteRuntimes.reduce((s, r) => s + r.assignments, 0),
    totalEvidenceRefs: contract.evidenceRefs.length,
    status: contract.status,
    createdAt: Date.now()
  };

  crossContracts.set(contract.id, crossContract);

  appendEvidenceRecord({
    evidence_id: hashTraceId(contract.id, 'cross_runtime_contract_created'),
    trace_id: contract.id,
    job_id: 'cross_runtime',
    type: 'execution_started',
    timestamp: new Date().toISOString(),
    payload: crossContract
  });

  return crossContract;
}

export function getCrossRuntimeContract(contractId: string): CrossRuntimeContract | undefined {
  return crossContracts.get(contractId);
}

export function getAllCrossRuntimeContracts(): CrossRuntimeContract[] {
  return [...crossContracts.values()];
}

export function updateCrossRuntimeContractStatus(contractId: string, status: CrossRuntimeContract['status']): boolean {
  const c = crossContracts.get(contractId);
  if (!c) return false;
  c.status = status;
  return true;
}

export function getRemoteEvidenceRefs(contractId: string): string[] {
  const c = crossContracts.get(contractId);
  if (!c) return [];

  const refs: string[] = [];
  for (const runtime of c.remoteRuntimes) {
    for (const workerId of runtime.workers) {
      const assignments = getAssignmentsByWorker(workerId);
      for (const a of assignments) {
        refs.push(...a.evidenceRefs);
      }
    }
  }
  return refs;
}

export function crossRuntimeSummary(): string {
  const all = getAllCrossRuntimeContracts();
  const active = all.filter(c => c.status === 'active').length;
  const completed = all.filter(c => c.status === 'completed').length;
  const remoteRuntimes = all.reduce((s, c) => s + c.remoteRuntimes.length, 0);
  return `Cross-runtime contracts: ${all.length} (active=${active}, completed=${completed}), spanning ${remoteRuntimes} remote runtimes`;
}
