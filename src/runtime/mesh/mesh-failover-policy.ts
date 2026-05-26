export type FailoverTrigger =
  | 'node_dead'
  | 'node_draining'
  | 'node_degraded'
  | 'heartbeat_timeout'
  | 'explicit_drain'
  | 'assignment_stuck';

export type FailoverStrategy =
  | 'immediate_reassign'
  | 'graceful_drain'
  | 'best_effort'
  | 'no_reassign';

export interface MeshFailoverPolicy {
  trigger: FailoverTrigger;
  strategy: FailoverStrategy;
  maxReassignmentAttempts: number;
  requireHealthyTarget: boolean;
  allowDegradedTarget: boolean;
  preserveEvidenceLinkage: boolean;
  emitAuditEvents: boolean;
  timeoutMs: number;
}

export interface FailoverDecision {
  nodeId: string;
  trigger: FailoverTrigger;
  strategy: FailoverStrategy;
  shouldReassign: boolean;
  targetNodeCandidates: string[];
  reason: string;
  timestamp: number;
  policy: MeshFailoverPolicy;
}

export const DEFAULT_FAILOVER_POLICY: MeshFailoverPolicy = {
  trigger: 'node_dead',
  strategy: 'immediate_reassign',
  maxReassignmentAttempts: 3,
  requireHealthyTarget: true,
  allowDegradedTarget: false,
  preserveEvidenceLinkage: true,
  emitAuditEvents: true,
  timeoutMs: 30000,
};

export function evaluateFailoverPolicy(
  nodeId: string,
  nodeStatus: string,
  trigger: FailoverTrigger,
  policy: MeshFailoverPolicy = DEFAULT_FAILOVER_POLICY
): FailoverDecision {
  const shouldReassign = policy.strategy !== 'no_reassign' &&
    (nodeStatus === 'dead' || nodeStatus === 'draining' || trigger === 'node_dead');

  return {
    nodeId,
    trigger,
    strategy: policy.strategy,
    shouldReassign,
    targetNodeCandidates: [],
    reason: `Node ${nodeId} is ${nodeStatus}, trigger=${trigger}`,
    timestamp: Date.now(),
    policy,
  };
}

export function isFailoverRequired(decision: FailoverDecision): boolean {
  return decision.shouldReassign;
}
