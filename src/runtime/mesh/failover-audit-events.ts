import type { AuditEvent } from './mesh-audit-events.js';

export interface FailoverAuditEvent extends AuditEvent {
  failoverKind: 'node_dead' | 'reassignment' | 'recovery_success' | 'recovery_failed' | 'evidence_linked';
  affectedNodeId: string;
  assignmentId?: string;
  targetNodeId?: string;
  recoveryEvidenceId?: string;
}

export function createFailoverAuditEvent(
  kind: FailoverAuditEvent['failoverKind'],
  nodeId: string,
  payload: Record<string, unknown> = {}
): FailoverAuditEvent {
  return {
    id: `failover_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    eventType: 'system',
    action: `failover.${kind}`,
    nodeId,
    payload,
    timestamp: Date.now(),
    metadata: { failoverKind: kind, affectedNodeId: nodeId, ...payload },
    severity: kind.includes('failed') ? 'high' : 'medium',
    source: 'mesh-failover',
    failoverKind: kind,
    affectedNodeId: nodeId,
    assignmentId: payload.assignmentId as string | undefined,
    targetNodeId: payload.targetNodeId as string | undefined,
    recoveryEvidenceId: payload.recoveryEvidenceId as string | undefined,
  };
}

export function emitFailoverEvent(event: FailoverAuditEvent): void {
  // In real system this would go to the central audit store
  // For now we just return the event for the runner to persist
  // Placeholder for future integration with mesh-audit-events store
}
