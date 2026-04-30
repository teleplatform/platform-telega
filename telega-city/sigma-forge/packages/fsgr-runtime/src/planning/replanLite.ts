import type { ExecutionGraph, ExecutionNode } from "../../fsgr-contracts/src/executionGraph.js";

export function replanAfterFailure(
  graph: ExecutionGraph,
  failedNodeId: string,
  fallbackSkillId?: string
): { updated: boolean; reason: string } {
  const node = graph.nodes.find((n) => n.node_id === failedNodeId);
  if (!node) return { updated: false, reason: `node ${failedNodeId} not found` };

  if (node.retry_count < node.max_retries) {
    node.retry_count++;
    node.status = "ready";
    return { updated: true, reason: `retry ${node.retry_count}/${node.max_retries}` };
  }

  if (fallbackSkillId && node.fallback_skill_id) {
    node.skill_id = node.fallback_skill_id;
    node.status = "ready";
    node.retry_count = 0;
    return { updated: true, reason: `fallback to ${node.skill_id}` };
  }

  node.status = "failed";
  const dependents = graph.nodes.filter((n) => n.dependency_ids.includes(failedNodeId));
  for (const dep of dependents) {
    dep.status = "blocked";
  }

  return { updated: false, reason: `node ${failedNodeId} exhausted retries, run degraded` };
}
