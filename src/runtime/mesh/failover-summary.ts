import type { FailoverDecision } from './mesh-failover-policy.js';
import type { RecoveryEvidenceLinkage } from './recovery-evidence-linkage.js';

export interface FailoverSummary {
  nodeId: string;
  trigger: string;
  strategy: string;
  reassignments: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  evidenceLinked: number;
  healthImpact: number;
  summary: string;
  timestamp: number;
}

export function generateFailoverSummary(
  decision: FailoverDecision,
  linkages: RecoveryEvidenceLinkage[]
): FailoverSummary {
  const successful = linkages.filter(l => l.newNodeId).length;
  const failed = linkages.length - successful;

  return {
    nodeId: decision.nodeId,
    trigger: decision.trigger,
    strategy: decision.strategy,
    reassignments: linkages.length,
    successfulRecoveries: successful,
    failedRecoveries: failed,
    evidenceLinked: linkages.length,
    healthImpact: failed > 0 ? -10 : 0,
    summary: `Failover for ${decision.nodeId}: ${successful}/${linkages.length} recovered`,
    timestamp: Date.now(),
  };
}
