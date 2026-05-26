import type { RuntimeWorker, WorkerAssignment, WorkerResult, WorkerAssignmentRequest } from './worker-types.js';
import type { GraphNode } from '../sigma-forge/sigma-forge-types.js';
import type { CapabilityHandlerMap } from '../sigma-forge/sigma-forge-types.js';
import { findBestWorker, assignNodeToWorker, updateAssignmentStatus, getAssignment, getAssignmentsByWorker } from './worker-assignment.js';
import { getWorker, updateWorkerStatus } from './worker-registry.js';
import { recordHeartbeat } from './worker-heartbeat.js';
import { appendEvidenceRecord } from '../evidence/execution-evidence-store.js';
import { hashTraceId } from '../evidence/execution-hash.js';

export interface WorkerExecutionOptions {
  handlers: CapabilityHandlerMap;
  emitEvidence?: boolean;
  graphId: string;
}

export async function executeNodeThroughWorker(
  node: GraphNode,
  options: WorkerExecutionOptions
): Promise<{ result: WorkerResult; assignment: WorkerAssignment | null }> {
  const { handlers, emitEvidence = true, graphId } = options;

  const req: WorkerAssignmentRequest = {
    graphId,
    nodeId: node.id,
    taskType: node.taskType,
    capability: node.capability
  };

  const assignResult = assignNodeToWorker(req);
  if ('error' in assignResult) {
    return {
      result: { ok: false, output: null, evidence: null, durationMs: 0, error: assignResult.error },
      assignment: null
    };
  }

  const { assignment, worker } = assignResult;
  const startTime = Date.now();

  updateAssignmentStatus(assignment.id, 'running', { startedAt: startTime });

  recordHeartbeat(worker.id, worker.assignedTaskIds.length, getMaxTasks(worker), 0);

  const handler = handlers[node.capability];
  if (!handler) {
    const err = `No handler for capability: ${node.capability}`;
    updateAssignmentStatus(assignment.id, 'failed', { error: err, completedAt: Date.now(), durationMs: Date.now() - startTime });
    return {
      result: { ok: false, output: null, evidence: null, durationMs: Date.now() - startTime, error: err },
      assignment
    };
  }

  try {
    const handlerResult = await handler(node);
    const durationMs = Date.now() - startTime;

    const evidenceRef = handlerResult.evidence ?? null;
    const refs = evidenceRef ? [evidenceRef] : [];

    if (emitEvidence) {
      await appendEvidenceRecord({
        evidence_id: hashTraceId(assignment.id, 'worker_execution_completed'),
        trace_id: graphId,
        job_id: assignment.id,
        type: 'execution_completed',
        timestamp: new Date().toISOString(),
        payload: {
          workerId: worker.id,
          workerName: worker.name,
          assignmentId: assignment.id,
          nodeId: node.id,
          taskType: node.taskType,
          durationMs,
          evidenceRef
        }
      });
    }

    updateAssignmentStatus(assignment.id, 'completed', {
      completedAt: Date.now(),
      evidenceRefs: refs,
      durationMs
    });

    recordHeartbeat(worker.id, worker.assignedTaskIds.length, getMaxTasks(worker), 0);

    return {
      result: { ok: true, output: handlerResult.result, evidence: evidenceRef, durationMs, error: null },
      assignment
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errMsg = String(err);

    if (emitEvidence) {
      await appendEvidenceRecord({
        evidence_id: hashTraceId(assignment.id, 'worker_execution_failed'),
        trace_id: graphId,
        job_id: assignment.id,
        type: 'execution_failed',
        timestamp: new Date().toISOString(),
        payload: {
          workerId: worker.id,
          workerName: worker.name,
          assignmentId: assignment.id,
          nodeId: node.id,
          taskType: node.taskType,
          durationMs,
          error: errMsg
        }
      });
    }

    updateAssignmentStatus(assignment.id, 'failed', {
      error: errMsg,
      completedAt: Date.now(),
      durationMs
    });

    recordHeartbeat(worker.id, worker.assignedTaskIds.length, getMaxTasks(worker), 1);

    return {
      result: { ok: false, output: null, evidence: null, durationMs, error: errMsg },
      assignment
    };
  }
}

function getMaxTasks(worker: RuntimeWorker): number {
  return worker.capabilities.reduce((s, c) => s + c.maxConcurrency, 0);
}

export function executeNodeDirect(node: GraphNode, handler: (node: GraphNode) => Promise<{ result: unknown; evidence?: string }>): Promise<WorkerResult> {
  const startTime = Date.now();
  return handler(node)
    .then(r => ({ ok: true, output: r.result, evidence: r.evidence ?? null, durationMs: Date.now() - startTime, error: null }))
    .catch(err => ({ ok: false, output: null, evidence: null, durationMs: Date.now() - startTime, error: String(err) }));
}
