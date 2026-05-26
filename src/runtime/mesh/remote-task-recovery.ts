import type { AssignmentEnvelope, AssignmentStatus } from './remote-assignment-envelope.js';
import type { FailoverDecision } from './mesh-failover-policy.js';

export interface RemoteTaskRecoveryRequest {
  assignmentId: string;
  originalNodeId: string;
  failureReason: string;
  trigger: string;
  preserveEvidence: boolean;
  maxAttempts: number;
}

export interface RemoteTaskRecoveryResult {
  success: boolean;
  assignmentId: string;
  recoveredAssignment?: AssignmentEnvelope;
  newNodeId?: string;
  newWorkerId?: string;
  attempts: number;
  error?: string;
  recoveryEvidenceId?: string;
}

export interface RemoteTaskRecoveryService {
  recoverAssignment(request: RemoteTaskRecoveryRequest): Promise<RemoteTaskRecoveryResult>;
  canRecover(assignment: AssignmentEnvelope, decision: FailoverDecision): boolean;
}

export class DefaultRemoteTaskRecoveryService implements RemoteTaskRecoveryService {
  async recoverAssignment(request: RemoteTaskRecoveryRequest): Promise<RemoteTaskRecoveryResult> {
    // Placeholder — real implementation will use cross-node-reassign
    return {
      success: false,
      assignmentId: request.assignmentId,
      attempts: 1,
      error: 'Recovery not yet wired to reassign engine',
    };
  }

  canRecover(assignment: AssignmentEnvelope, decision: FailoverDecision): boolean {
    const terminalStates: AssignmentStatus[] = ['completed', 'failed', 'cancelled'];
    return !terminalStates.includes(assignment.status) &&
      decision.shouldReassign;
  }
}

export function createRecoveryRequest(
  assignment: AssignmentEnvelope,
  decision: FailoverDecision
): RemoteTaskRecoveryRequest {
  return {
    assignmentId: assignment.id,
    originalNodeId: assignment.assignedNodeId,
    failureReason: `Failover triggered by ${decision.trigger}`,
    trigger: decision.trigger,
    preserveEvidence: decision.policy.preserveEvidenceLinkage,
    maxAttempts: decision.policy.maxReassignmentAttempts,
  };
}
