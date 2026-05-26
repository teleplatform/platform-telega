import { ExecutionGraph, GraphNode, GraphEdge } from './sigma-forge-types.js';

let graphCounter = 0;

export function generateGraphId(): string {
  return `eg_${Date.now()}_${String(++graphCounter).padStart(4, '0')}`;
}

export function buildGraph(
  intent: string,
  name: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  phaseOrder: string[]
): ExecutionGraph {
  const now = Date.now();
  return {
    id: generateGraphId(),
    name,
    intent,
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    phaseOrder,
    metadata: {}
  };
}

export function addNode(graph: ExecutionGraph, node: GraphNode): void {
  graph.nodes.push(node);
  graph.updatedAt = Date.now();
}

export function addEdge(graph: ExecutionGraph, edge: GraphEdge): void {
  graph.edges.push(edge);
  graph.updatedAt = Date.now();
}

export function topologicalSort(graph: ExecutionGraph): GraphNode[] {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeId);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
  return sorted.map(id => nodeMap.get(id)!);
}

export function getParallelGroups(graph: ExecutionGraph): GraphNode[][] {
  const sorted = topologicalSort(graph);
  if (sorted.length === 0) return [];

  const groups: GraphNode[][] = [];
  const nodeDepths = new Map<string, number>();

  for (const node of sorted) {
    const incomingEdges = graph.edges.filter(e => e.to === node.id);
    if (incomingEdges.length === 0) {
      nodeDepths.set(node.id, 0);
    } else {
      const maxDepth = Math.max(...incomingEdges.map(e => nodeDepths.get(e.from) ?? 0));
      nodeDepths.set(node.id, maxDepth + 1);
    }
  }

  const depthGroups = new Map<number, GraphNode[]>();
  for (const node of sorted) {
    const depth = nodeDepths.get(node.id) ?? 0;
    if (!depthGroups.has(depth)) depthGroups.set(depth, []);
    depthGroups.get(depth)!.push(node);
  }

  const sortedDepths = [...depthGroups.keys()].sort((a, b) => a - b);
  for (const depth of sortedDepths) {
    groups.push(depthGroups.get(depth)!);
  }

  return groups;
}

export function getReadyNodes(graph: ExecutionGraph): GraphNode[] {
  return graph.nodes.filter(node => {
    if (node.status !== 'pending') return false;
    const deps = graph.edges.filter(e => e.to === node.id);
    return deps.every(dep => {
      const depNode = graph.nodes.find(n => n.id === dep.from);
      return depNode?.status === 'completed';
    });
  });
}

export function getDependencyChain(graph: ExecutionGraph, nodeId: string): GraphNode[] {
  const chain: GraphNode[] = [];
  const visited = new Set<string>();

  function walk(currentId: string): void {
    if (visited.has(currentId)) return;
    visited.add(currentId);
    const node = graph.nodes.find(n => n.id === currentId);
    if (node) {
      chain.push(node);
      const incoming = graph.edges.filter(e => e.to === currentId);
      for (const edge of incoming) {
        walk(edge.from);
      }
    }
  }

  walk(nodeId);
  return chain;
}

export function updateNodeStatus(
  graph: ExecutionGraph,
  nodeId: string,
  status: GraphNode['status'],
  updates?: Partial<GraphNode>
): void {
  const node = graph.nodes.find(n => n.id === nodeId);
  if (!node) return;
  node.status = status;
  if (updates) {
    if (updates.output !== undefined) node.output = updates.output;
    if (updates.error !== undefined) node.error = updates.error;
    if (updates.retryCount !== undefined) node.retryCount = updates.retryCount;
    if (updates.checkpointId !== undefined) node.checkpointId = updates.checkpointId;
    if (updates.traceId !== undefined) node.traceId = updates.traceId;
    if (updates.evidenceRef !== undefined) node.evidenceRef = updates.evidenceRef;
    if (updates.startedAt !== undefined) node.startedAt = updates.startedAt;
    if (updates.completedAt !== undefined) node.completedAt = updates.completedAt;
    if (updates.durationMs !== undefined) node.durationMs = updates.durationMs;
  }
  graph.updatedAt = Date.now();
}

export function markGraphStatus(graph: ExecutionGraph, status: ExecutionGraph['status']): void {
  graph.status = status;
  graph.updatedAt = Date.now();
}
