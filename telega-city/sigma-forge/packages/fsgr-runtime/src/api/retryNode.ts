import type { FsgrRuntime } from "../runtime/initRuntime.js";

export function retryFsgrNode(runtime: FsgrRuntime, runId: string, nodeId: string): { status: string; error?: string } {
  const nodes = runtime.ledgerStore.getNodes(runId);
  const node = nodes.find((n: any) => n.node_id === nodeId);
  if (!node) return { status: "error", error: `Node ${nodeId} not found` };
  if (node.status !== "failed") return { status: "error", error: `Node ${nodeId} is not failed (status: ${node.status})` };

  runtime.ledgerStore.updateNode(nodeId, { status: "ready", retry_count: (node.retry_count || 0) + 1 });
  runtime.ledgerStore.appendEvent({ run_id: runId, node_id: nodeId, event_type: "node.retry_scheduled", payload: { node_id: nodeId } });

  return { status: "scheduled" };
}
