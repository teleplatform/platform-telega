import { getAssignments, CrossNodeAssignmentStore } from './cross-node-assignment-store.js';
import { getOnlineMeshNodes } from './runtime-node-registry.js';
import { evaluateFailoverPolicy } from './mesh-failover-policy.js';
import { createRecoveryRequest, DefaultRemoteTaskRecoveryService } from './remote-task-recovery.js';
import { selectBestReassignTarget, performCrossNodeReassign } from './cross-node-reassign.js';
import { createRecoveryEvidenceLinkage } from './recovery-evidence-linkage.js';
import { createFailoverAuditEvent } from './failover-audit-events.js';
import { generateFailoverSummary } from './failover-summary.js';
import type { AssignmentEnvelope } from './remote-assignment-envelope.js';

const assignmentStore = new CrossNodeAssignmentStore();
const recoveryService = new DefaultRemoteTaskRecoveryService();

export interface FailoverRunResult {
  nodeId: string;
  decisions: any[];
  reassignments: any[];
  auditEvents: any[];
  summary: any;
}

export async function runFailoverForDeadNode(nodeId: string): Promise<FailoverRunResult> {
  const decision = evaluateFailoverPolicy(nodeId, 'dead', 'node_dead');

  // Get assignments that were on the dead node
  const queryResult: any = assignmentStore.getAssignments({ nodeId });
  const assignments: AssignmentEnvelope[] = Array.isArray(queryResult)
    ? queryResult
    : (queryResult?.assignments || []);

  const reassignments: any[] = [];
  const auditEvents: any[] = [];

  for (const assignment of assignments) {
    const recoveryReq = createRecoveryRequest(assignment, decision);

    // Find healthy targets
    const healthyNodes = getOnlineMeshNodes().filter(n => n.id !== nodeId);

    const reassignReq = {
      assignment,
      failedNodeId: nodeId,
      candidateNodes: healthyNodes,
      decision,
    };

    const reassignResult = await performCrossNodeReassign(reassignReq);

    if (reassignResult.success && reassignResult.newNodeId) {
      // Mutate the assignment
      await assignmentStore.reassignAssignment(
        assignment.id,
        reassignResult.newNodeId,
        reassignResult.newWorkerId,
        'failover recovery'
      );

      const linkage = createRecoveryEvidenceLinkage(
        assignment,
        nodeId,
        reassignResult.newNodeId,
        reassignResult.reassignEvidenceId || `rec_${Date.now()}`
      );

      auditEvents.push(
        createFailoverAuditEvent('reassignment', nodeId, {
          assignmentId: assignment.id,
          targetNodeId: reassignResult.newNodeId,
          recoveryEvidenceId: linkage.recoveryEvidenceId,
        })
      );

      reassignments.push({
        assignmentId: assignment.id,
        from: nodeId,
        to: reassignResult.newNodeId,
        linkage,
      });
    }
  }

  const summary = generateFailoverSummary(decision, reassignments.map(r => r.linkage));

  return {
    nodeId,
    decisions: [decision],
    reassignments,
    auditEvents,
    summary,
  };
}
