import type { ExecutionNode } from "../../fsgr-contracts/src/index.js";

export function areDependenciesSatisfied(node: ExecutionNode, allNodes: ExecutionNode[]): boolean {
  if (node.dependency_ids.length === 0) return true;
  return node.dependency_ids.every((depId) => {
    const dep = allNodes.find((n) => n.node_id === depId);
    return dep?.status === "completed";
  });
}

export function getReadyNodes(nodes: ExecutionNode[]): ExecutionNode[] {
  return nodes.filter((node) => {
    if (node.status === "ready") return true;
    if (node.status === "waiting_dependency" && areDependenciesSatisfied(node, nodes)) return true;
    return false;
  });
}

export function getBlockingDependencies(node: ExecutionNode, allNodes: ExecutionNode[]): string[] {
  return node.dependency_ids.filter((depId) => {
    const dep = allNodes.find((n) => n.node_id === depId);
    return dep?.status !== "completed";
  });
}
