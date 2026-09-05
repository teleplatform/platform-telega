import { JobNode, JobGraph, JobGraphSummary } from "./jobTypes";

const graphs = new Map<string, JobGraph>();

let counter = 0;
function genId(prefix: string): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

export const JobRegistry = {
  create(title: string, description: string, nodes: Omit<JobNode, "id">[]): JobGraph {
    const now = Date.now();
    const assignedIds = nodes.map(() => genId("jnode"));

    const resolvedNodes: JobNode[] = nodes.map((n, i) => {
      const resolved = n.dependsOn.map((dep) => {
        if (assignedIds.includes(dep)) return dep;
        const idx = parseInt(dep, 10);
        if (!isNaN(idx) && idx >= 0 && idx < assignedIds.length) return assignedIds[idx];
        const byTitle = nodes.findIndex((nd, ni) => ni !== i && nd.title === dep);
        if (byTitle >= 0) return assignedIds[byTitle];
        return dep;
      });
      return { ...n, id: assignedIds[i], dependsOn: resolved };
    });

    const graph: JobGraph = {
      id: genId("jgraph"),
      title,
      description,
      nodes: resolvedNodes,
      edges: [],
      status: "created",
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    };

    for (const node of graph.nodes) {
      for (const depId of node.dependsOn) {
        const depNode = graph.nodes.find((n) => n.id === depId);
        if (depNode) graph.edges.push({ from: depId, to: node.id, type: "depends_on" });
      }
    }

    graphs.set(graph.id, graph);
    return graph;
  },

  get(id: string): JobGraph | undefined {
    return graphs.get(id);
  },

  getAll(): JobGraph[] {
    return Array.from(graphs.values());
  },

  update(id: string, updates: Partial<JobGraph>): JobGraph | null {
    const existing = graphs.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    graphs.set(id, updated);
    return updated;
  },

  updateNode(graphId: string, nodeId: string, updates: Partial<JobNode>): JobGraph | null {
    const graph = graphs.get(graphId);
    if (!graph) return null;

    const idx = graph.nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) return null;

    const updatedNode = { ...graph.nodes[idx], ...updates, id: nodeId };
    const updatedNodes = [...graph.nodes];
    updatedNodes[idx] = updatedNode;
    return this.update(graphId, { nodes: updatedNodes });
  },

  getSummary(id: string): JobGraphSummary | null {
    const graph = graphs.get(id);
    if (!graph) return null;

    const total = graph.nodes.length;
    const completed = graph.nodes.filter((n) => n.status === "completed").length;
    const failed = graph.nodes.filter((n) => n.status === "failed").length;
    const running = graph.nodes.filter((n) => n.status === "running").length;
    const pending = graph.nodes.filter((n) => n.status === "pending" || n.status === "ready").length;
    const blocked = graph.nodes.filter((n) => n.status === "blocked").length;

    return {
      total,
      completed,
      failed,
      running,
      pending,
      blocked,
      durationMs: graph.startedAt && graph.completedAt ? graph.completedAt - graph.startedAt : null,
    };
  },

  delete(id: string): boolean {
    return graphs.delete(id);
  },

  size(): number {
    return graphs.size;
  },
};
