import { sweepDeadMeshNodes, getAllMeshNodes } from './mesh-heartbeat.js';
import { getAssignments } from './cross-node-assignment-store.js'; // assuming re-export or direct import
import type { FailoverDecision } from './mesh-failover-policy.js';
import { evaluateFailoverPolicy } from './mesh-failover-policy.js';
import { createFailoverAuditEvent } from './failover-audit-events.js';

export interface DeadNodeSweepResult {
  deadNodes: string[];
  degradedNodes: string[];
  failoverDecisions: FailoverDecision[];
  auditEvents: any[];
}

export function runDeadNodeSweepForFailover(): DeadNodeSweepResult {
  const { dead, degraded } = sweepDeadMeshNodes();
  const decisions: FailoverDecision[] = [];
  const auditEvents: any[] = [];

  const allDead = [...dead, ...degraded];

  for (const nodeId of allDead) {
    const decision = evaluateFailoverPolicy(nodeId, 'dead', 'node_dead');

    // Find assignments on this node (simplified; in real code use the store)
    // For now we just record the decision
    decisions.push(decision);

    auditEvents.push(
      createFailoverAuditEvent('node_dead', nodeId, {
        decision: decision.strategy,
        trigger: decision.trigger,
      })
    );
  }

  return {
    deadNodes: dead,
    degradedNodes: degraded,
    failoverDecisions: decisions,
    auditEvents,
  };
}
