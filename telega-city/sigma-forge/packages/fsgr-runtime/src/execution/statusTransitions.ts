import type { NodeStatus, RunStatus } from "../../fsgr-contracts/src/index.js";
import type { ExecutionNode } from "../../fsgr-contracts/src/index.js";

const ALLOWED_NODE_TRANSITIONS: Record<NodeStatus, NodeStatus[]> = {
  pending: ["ready"],
  ready: ["running"],
  running: ["completed", "failed"],
  blocked: [],
  waiting_dependency: ["ready"],
  needs_review: ["completed", "failed"],
  failed: ["ready", "blocked", "rolled_back"],
  completed: [],
  rolled_back: ["ready"],
};

export function canTransition(from: NodeStatus, to: NodeStatus): boolean {
  return ALLOWED_NODE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionNodeStatus(node: ExecutionNode, to: NodeStatus): boolean {
  if (!canTransition(node.status, to)) return false;
  node.status = to;
  return true;
}

export function deriveRunStatus(nodes: ExecutionNode[], currentRunStatus: RunStatus): RunStatus {
  if (nodes.length === 0) return "failed";

  const allCompleted = nodes.every((n) => n.status === "completed");
  if (allCompleted) return "completed";

  const hasActive = nodes.some((n) => n.status === "ready" || n.status === "running" || n.status === "waiting_dependency");
  if (hasActive) {
    const hasFailed = nodes.some((n) => n.status === "failed" || n.status === "blocked");
    return hasFailed ? "degraded" : "running";
  }

  const allTerminal = nodes.every((n) => n.status === "completed" || n.status === "failed" || n.status === "blocked" || n.status === "rolled_back");
  if (allTerminal) {
    const hasCompleted = nodes.some((n) => n.status === "completed");
    return hasCompleted ? "degraded" : "failed";
  }

  return currentRunStatus;
}
