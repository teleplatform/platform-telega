import type { ExecutionGraph, ExecutionNode, ExecutionEdge, NodeStatus } from "../../../fsgr-contracts/src/index.js";
import type { WorkUnit } from "./decompose.js";
import type { PlanMode } from "../../../fsgr-contracts/src/index.js";

export function buildExecutionGraph(
  runId: string,
  task: { task_id: string; goal: string },
  workUnits: WorkUnit[],
  planMode: PlanMode
): { graph: ExecutionGraph; errors: string[] } {
  const errors: string[] = [];

  if (workUnits.length === 0) {
    errors.push("Empty work units — cannot build graph");
    return { graph: emptyGraph(runId, planMode), errors };
  }

  const nodes: ExecutionNode[] = [];
  const edges: ExecutionEdge[] = [];
  const entryNodes: string[] = [];
  const terminalNodes: string[] = [];

  for (const unit of workUnits) {
    const hasDeps = unit.depends_on.length > 0;
    const status: NodeStatus = hasDeps ? "waiting_dependency" : "ready";

    const node: ExecutionNode = {
      node_id: unit.work_unit_id,
      skill_id: unit.skill_id,
      title: unit.title,
      status,
      input_refs: [],
      output_refs: [`${unit.work_unit_id}_output`],
      dependency_ids: [...unit.depends_on],
      validator_hooks: [],
      retry_count: 0,
      max_retries: 2,
      fallback_skill_id: undefined,
      risk_class: "low",
    };
    nodes.push(node);

    if (!hasDeps) entryNodes.push(unit.work_unit_id);

    for (const depId of unit.depends_on) {
      edges.push({ from_node_id: depId, to_node_id: unit.work_unit_id, kind: "dependency" });
    }
  }

  for (const node of nodes) {
    const hasOutgoing = edges.some((e) => e.from_node_id === node.node_id);
    if (!hasOutgoing) terminalNodes.push(node.node_id);
  }

  if (hasCycle(nodes, edges)) {
    errors.push("Cycle detected in execution graph");
    return { graph: emptyGraph(runId, planMode), errors };
  }

  const allNodeIds = new Set(nodes.map((n) => n.node_id));
  for (const node of nodes) {
    for (const depId of node.dependency_ids) {
      if (!allNodeIds.has(depId)) {
        errors.push(`Missing dependency reference: ${depId} in node ${node.node_id}`);
        return { graph: emptyGraph(runId, planMode), errors };
      }
    }
  }

  return {
    graph: {
      graph_id: `graph_${runId}`,
      run_id: runId,
      version: 1,
      plan_mode: planMode,
      nodes,
      edges,
      entry_nodes: entryNodes,
      terminal_nodes: terminalNodes,
    },
    errors,
  };
}

function emptyGraph(runId: string, planMode: PlanMode): ExecutionGraph {
  return { graph_id: `graph_${runId}`, run_id: runId, version: 1, plan_mode: planMode, nodes: [], edges: [], entry_nodes: [], terminal_nodes: [] };
}

function hasCycle(nodes: ExecutionNode[], edges: ExecutionEdge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const node of nodes) adj.set(node.node_id, []);
  for (const edge of edges) adj.get(edge.from_node_id)?.push(edge.to_node_id);

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const neighbor of adj.get(nodeId) ?? []) {
      if (dfs(neighbor)) return true;
    }
    inStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (dfs(node.node_id)) return true;
  }
  return false;
}

export function validateExecutionGraph(graph: ExecutionGraph): string[] {
  const errors: string[] = [];
  if (graph.nodes.length === 0) errors.push("Empty graph");
  if (graph.edges.length === 0 && graph.nodes.length > 1) errors.push("Disconnected graph");
  if (hasCycle(graph.nodes, graph.edges)) errors.push("Cycle detected");

  const allNodeIds = new Set(graph.nodes.map((n) => n.node_id));
  for (const node of graph.nodes) {
    for (const depId of node.dependency_ids) {
      if (!allNodeIds.has(depId)) errors.push(`Missing dependency: ${depId}`);
    }
  }
  return errors;
}

export function detectGraphCycle(graph: ExecutionGraph): boolean {
  return hasCycle(graph.nodes, graph.edges);
}
