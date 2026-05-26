import type { WorkerAssignment, WorkerResult } from './worker-types.js';
import { appendEvidenceRecord } from '../evidence/execution-evidence-store.js';
import { hashTraceId } from '../evidence/execution-hash.js';

export interface EvidenceLink {
  assignmentId: string;
  nodeId: string;
  workerId: string;
  evidenceRef: string | null;
  taskType: string;
  status: string;
  timestamp: string;
}

export function recordWorkerEvidenceLinks(assignment: WorkerAssignment, result: WorkerResult): EvidenceLink[] {
  const links: EvidenceLink[] = [];

  if (result.evidence) {
    links.push({
      assignmentId: assignment.id,
      nodeId: assignment.nodeId,
      workerId: assignment.workerId,
      evidenceRef: result.evidence,
      taskType: assignment.taskType,
      status: assignment.status,
      timestamp: new Date().toISOString()
    });
  }

  const mainLink: EvidenceLink = {
    assignmentId: assignment.id,
    nodeId: assignment.nodeId,
    workerId: assignment.workerId,
    evidenceRef: result.evidence,
    taskType: assignment.taskType,
    status: assignment.status,
    timestamp: new Date().toISOString()
  };
  links.push(mainLink);

  return links;
}

export async function emitWorkerEvidence(assignment: WorkerAssignment, result: WorkerResult): Promise<void> {
  const links = recordWorkerEvidenceLinks(assignment, result);

  for (const link of links) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(link.assignmentId, 'worker_evidence_linked'),
      trace_id: link.assignmentId,
      job_id: link.workerId,
      type: 'artifact_emitted',
      timestamp: link.timestamp,
      payload: link
    });
  }
}

export function formatWorkerEvidenceSummary(assignments: WorkerAssignment[]): string {
  const totalEvidence = assignments.reduce((s, a) => s + a.evidenceRefs.length, 0);
  const completed = assignments.filter(a => a.status === 'completed').length;
  const failed = assignments.filter(a => a.status === 'failed').length;

  return [
    `Worker evidence summary:`,
    `  Assignments: ${assignments.length} (completed=${completed}, failed=${failed})`,
    `  Evidence refs: ${totalEvidence}`
  ].join('\n');
}
