import type { RuntimeWorker, WorkerAssignment, WorkerAssignmentRequest, AssignmentStatus } from './worker-types.js';
import type { TaskType } from '../sigma-forge/sigma-forge-types.js';
import { getOnlineWorkers, getWorkersByCapability, assignTaskToWorker } from './worker-registry.js';

const assignments = new Map<string, WorkerAssignment>();

let assignmentCounter = 0;

function generateAssignmentId(): string {
  return `wa_${Date.now()}_${String(++assignmentCounter).padStart(4, '0')}`;
}

export function findBestWorker(taskType: TaskType): RuntimeWorker | undefined {
  const candidates = getWorkersByCapability(taskType).filter(w =>
    w.status === 'online' || w.status === 'busy'
  );
  if (candidates.length === 0) return undefined;

  return candidates.reduce((best, current) => {
    const bestLoad = best.assignedTaskIds.length / best.capabilities.reduce((s, c) => s + c.maxConcurrency, 0);
    const currentLoad = current.assignedTaskIds.length / current.capabilities.reduce((s, c) => s + c.maxConcurrency, 0);
    return currentLoad < bestLoad ? current : best;
  });
}

export function assignNodeToWorker(req: WorkerAssignmentRequest): { assignment: WorkerAssignment; worker: RuntimeWorker } | { error: string } {
  const worker = findBestWorker(req.taskType);
  if (!worker) {
    return { error: `No available worker for task type: ${req.taskType}` };
  }

  const assignment: WorkerAssignment = {
    id: generateAssignmentId(),
    workerId: worker.id,
    graphId: req.graphId,
    nodeId: req.nodeId,
    taskType: req.taskType,
    status: 'pending',
    assignedAt: Date.now(),
    startedAt: null,
    completedAt: null,
    evidenceRefs: [],
    contractId: null,
    error: null,
    durationMs: null
  };

  assignments.set(assignment.id, assignment);
  assignTaskToWorker(worker.id, assignment.id);

  return { assignment, worker };
}

export function updateAssignmentStatus(assignmentId: string, status: AssignmentStatus, updates?: Partial<WorkerAssignment>): boolean {
  const a = assignments.get(assignmentId);
  if (!a) return false;
  a.status = status;
  if (updates) {
    if (updates.startedAt !== undefined) a.startedAt = updates.startedAt;
    if (updates.completedAt !== undefined) a.completedAt = updates.completedAt;
    if (updates.evidenceRefs !== undefined) a.evidenceRefs = updates.evidenceRefs;
    if (updates.contractId !== undefined) a.contractId = updates.contractId;
    if (updates.error !== undefined) a.error = updates.error;
    if (updates.durationMs !== undefined) a.durationMs = updates.durationMs;
  }
  return true;
}

export function getAssignment(assignmentId: string): WorkerAssignment | undefined {
  return assignments.get(assignmentId);
}

export function getAssignmentsByGraph(graphId: string): WorkerAssignment[] {
  return [...assignments.values()].filter(a => a.graphId === graphId);
}

export function getAssignmentsByWorker(workerId: string): WorkerAssignment[] {
  return [...assignments.values()].filter(a => a.workerId === workerId);
}

export function getAssignmentsByNode(nodeId: string): WorkerAssignment[] {
  return [...assignments.values()].filter(a => a.nodeId === nodeId);
}

export function getPendingAssignments(): WorkerAssignment[] {
  return [...assignments.values()].filter(a => a.status === 'pending' || a.status === 'running');
}

export function getAssignmentsByStatus(status: AssignmentStatus): WorkerAssignment[] {
  return [...assignments.values()].filter(a => a.status === status);
}

export function reassignAssignment(assignmentId: string): { assignment: WorkerAssignment; worker: RuntimeWorker } | { error: string } {
  const existing = assignments.get(assignmentId);
  if (!existing) return { error: `Assignment ${assignmentId} not found` };
  if (existing.status === 'completed') return { error: 'Cannot reassign completed assignment' };

  const req: WorkerAssignmentRequest = {
    graphId: existing.graphId,
    nodeId: existing.nodeId,
    taskType: existing.taskType,
    capability: existing.taskType.includes('.') ? existing.taskType.split('.')[0] as any : 'execution'
  };

  const result = assignNodeToWorker(req);
  if ('error' in result) return result;

  existing.status = 'reassigned';
  return result;
}

export function assignmentSummary(): string {
  const all = [...assignments.values()];
  const pending = all.filter(a => a.status === 'pending').length;
  const running = all.filter(a => a.status === 'running').length;
  const completed = all.filter(a => a.status === 'completed').length;
  const failed = all.filter(a => a.status === 'failed').length;
  const reassigned = all.filter(a => a.status === 'reassigned').length;
  return `Assignments: ${all.length} (pending=${pending}, running=${running}, completed=${completed}, failed=${failed}, reassigned=${reassigned})`;
}
