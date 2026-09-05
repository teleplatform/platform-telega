import { TaskGraph, GraphNode, GraphEdge } from "./graphTypes";
import { TaskRegistry } from "../agent-tasks/taskRegistry.js";

const graphs = new Map<string, TaskGraph>();

let counter = 0;
function genId(): string {
  counter++;
  return `ag_${Date.now()}_${counter}`;
}

export const GraphRegistry = {
  create(
    name: string,
    description: string,
    taskIds: string[],
    missionId?: string,
    spaceId?: string
  ): TaskGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    for (const tid of taskIds) {
      const task = TaskRegistry.get(tid);
      if (!task) continue;

      const node: GraphNode = {
        taskId: tid,
        title: task.title,
        status: task.status === "completed" ? "completed" : task.status === "failed" ? "failed" : "pending",
        dependsOn: task.dependsOn.map((d) => d.taskId),
      };
      nodes.push(node);
    }

    // Build edges from dependsOn
    for (const node of nodes) {
      for (const depId of node.dependsOn) {
        if (nodes.find((n) => n.taskId === depId)) {
          edges.push({ from: depId, to: node.taskId, type: "depends_on" });
        }
      }
    }

    const graph: TaskGraph = {
      id: genId(),
      name,
      description,
      nodes,
      edges,
      status: "created",
      missionId: missionId || null,
      spaceId: spaceId || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    graphs.set(graph.id, graph);
    return graph;
  },

  get(id: string): TaskGraph | undefined {
    return graphs.get(id);
  },

  getAll(): TaskGraph[] {
    return Array.from(graphs.values());
  },

  update(id: string, updates: Partial<TaskGraph>): TaskGraph | null {
    const existing = graphs.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    graphs.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return graphs.delete(id);
  },

  listByMission(missionId: string): TaskGraph[] {
    return Array.from(graphs.values()).filter((g) => g.missionId === missionId);
  },

  listBySpace(spaceId: string): TaskGraph[] {
    return Array.from(graphs.values()).filter((g) => g.spaceId === spaceId);
  },

  refreshFromTasks(graphId: string): TaskGraph | null {
    const graph = graphs.get(graphId);
    if (!graph) return null;

    const updatedNodes = graph.nodes.map((node) => {
      const task = TaskRegistry.get(node.taskId);
      if (!task) return node;
      return {
        ...node,
        title: task.title,
        status: task.status as GraphNode["status"],
        dependsOn: task.dependsOn.map((d) => d.taskId),
      };
    });

    return this.update(graphId, { nodes: updatedNodes });
  },

  size(): number {
    return graphs.size;
  },
};
