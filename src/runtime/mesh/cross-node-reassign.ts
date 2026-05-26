import type { AssignmentEnvelope } from './remote-assignment-envelope.js';
import type { MeshNodeInfo } from './mesh-node-types.js';
import type { FailoverDecision } from './mesh-failover-policy.js';

export interface CrossNodeReassignRequest {
  assignment: AssignmentEnvelope;
  failedNodeId: string;
  candidateNodes: MeshNodeInfo[];
  decision: FailoverDecision;
}

export interface CrossNodeReassignResult {
  success: boolean;
  assignmentId: string;
  newNodeId?: string;
  newWorkerId?: string;
  reassignEvidenceId?: string;
  error?: string;
  attempts: number;
}

export function selectBestReassignTarget(
  candidates: MeshNodeInfo[],
  decision: FailoverDecision
): MeshNodeInfo | null {
  const healthy = candidates.filter(n =>
    n.status === 'online' &&
    (decision.policy.allowDegradedTarget || n.status !== 'degraded')
  );

  if (healthy.length === 0) return null;

  // Simple scoring: prefer nodes with lower load and more workers
  return healthy.sort((a, b) => {
    const aLoad = a.capabilities.reduce((s, c) => s + c.currentLoad, 0);
    const bLoad = b.capabilities.reduce((s, c) => s + c.currentLoad, 0);
    return (aLoad / (a.workerCount || 1)) - (bLoad / (b.workerCount || 1));
  })[0];
}

export async function performCrossNodeReassign(
  request: CrossNodeReassignRequest
): Promise<CrossNodeReassignResult> {
  const target = selectBestReassignTarget(request.candidateNodes, request.decision);

  if (!target) {
    return {
      success: false,
      assignmentId: request.assignment.id,
      error: 'No suitable healthy target node found',
      attempts: 1,
    };
  }

  // In real impl: create new assignment envelope, link recovery evidence, update status
  return {
    success: true,
    assignmentId: request.assignment.id,
    newNodeId: target.id,
    newWorkerId: 'auto-select',
    attempts: 1,
    reassignEvidenceId: `recovery_${Date.now()}`,
  };
}
