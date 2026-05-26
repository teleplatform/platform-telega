import type { AssignmentEnvelope } from './remote-assignment-envelope.js';
import type { AuditEvent } from './mesh-audit-events.js';

export interface RecoveryEvidenceLinkage {
  originalAssignmentId: string;
  failedNodeId: string;
  newAssignmentId?: string;
  newNodeId?: string;
  recoveryEvidenceId: string;
  auditEventIds: string[];
  timestamp: number;
}

export function createRecoveryEvidenceLinkage(
  originalAssignment: AssignmentEnvelope,
  failedNodeId: string,
  newNodeId: string,
  recoveryEvidenceId: string
): RecoveryEvidenceLinkage {
  return {
    originalAssignmentId: originalAssignment.id,
    failedNodeId,
    newNodeId,
    recoveryEvidenceId,
    auditEventIds: [],
    timestamp: Date.now(),
  };
}

export function linkRecoveryToAudit(
  linkage: RecoveryEvidenceLinkage,
  auditEvent: AuditEvent
): void {
  linkage.auditEventIds.push(auditEvent.id);
}
