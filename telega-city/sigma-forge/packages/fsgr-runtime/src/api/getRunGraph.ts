import type { FsgrRuntime } from "../runtime/initRuntime.js";

export function getFsgrRunGraph(runtime: FsgrRuntime, runId: string) {
  const nodes = runtime.ledgerStore.getNodes(runId);
  const ledger = runtime.ledgerStore.getRun(runId);
  if (!ledger) return null;

  return {
    graph_id: ledger.graph_id,
    run_id: runId,
    version: 1,
    plan_mode: ledger.plan_mode,
    nodes,
    edges: buildEdges(nodes),
    entry_nodes: nodes.filter((n: any) => n.status === "ready" || (n.dependency_ids_json === "[]" || n.dependency_ids_json === "null")).map((n: any) => n.node_id),
    terminal_nodes: nodes.filter((n: any) => {
      const allNodeIds = nodes.map((x: any) => x.node_id);
      return !nodes.some((x: any) => {
        try { return JSON.parse(x.dependency_ids_json || "[]").includes(n.node_id); } catch { return false; }
      });
    }).map((n: any) => n.node_id),
  };
}

function buildEdges(nodes: any[]) {
  const edges: any[] = [];
  for (const node of nodes) {
    try {
      const deps = JSON.parse(node.dependency_ids_json || "[]");
      for (const depId of deps) {
        edges.push({ from_node_id: depId, to_node_id: node.node_id, kind: "dependency" });
      }
    } catch { /* skip */ }
  }
  return edges;
}
