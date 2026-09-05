import { JobGraph, JobNode, JobStatus } from "./jobTypes";
import { JobRegistry } from "./jobRegistry";

function getReadyNodes(graph: JobGraph): JobNode[] {
  return graph.nodes.filter((n) => {
    if (n.status !== "pending") return false;
    return n.dependsOn.every((depId) => {
      const dep = graph.nodes.find((d) => d.id === depId);
      return dep?.status === "completed" || dep?.status === "skipped";
    });
  });
}

function getBlockedNodes(graph: JobGraph): JobNode[] {
  return graph.nodes.filter((n) => {
    if (n.status !== "pending") return false;
    return n.dependsOn.some((depId) => {
      const dep = graph.nodes.find((d) => d.id === depId);
      return dep?.status === "failed" || dep?.status === "blocked";
    });
  });
}

export function startGraph(graphId: string): JobGraph | null {
  const graph = JobRegistry.get(graphId);
  if (!graph || graph.status !== "created") return null;

  const now = Date.now();
  const readyNodes = getReadyNodes(graph);
  const updatedNodes = graph.nodes.map((n) =>
    readyNodes.some((r) => r.id === n.id)
      ? { ...n, status: "ready" as JobStatus }
      : n
  );

  return JobRegistry.update(graphId, {
    status: "running",
    startedAt: now,
    nodes: updatedNodes,
  });
}

export function startJob(graphId: string, nodeId: string): JobGraph | null {
  const graph = JobRegistry.get(graphId);
  if (!graph) return null;

  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node || node.status !== "ready") return null;

  return JobRegistry.updateNode(graphId, nodeId, {
    status: "running",
    startedAt: Date.now(),
  });
}

export function completeJob(graphId: string, nodeId: string, result?: string): JobGraph | null {
  const graph = JobRegistry.get(graphId);
  if (!graph) return null;

  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node || node.status !== "running") return null;

  const now = Date.now();
  const durationMs = node.startedAt ? now - node.startedAt : 0;

  let updated = JobRegistry.updateNode(graphId, nodeId, {
    status: "completed",
    completedAt: now,
    durationMs,
    result: result || null,
  });

  if (!updated) return null;

  // Cascade: mark ready nodes
  const nextReady = getReadyNodes(updated);
  for (const next of nextReady) {
    updated = JobRegistry.updateNode(graphId, next.id, { status: "ready" });
    if (!updated) return null;
  }

  // Check if all done
  const allDone = updated.nodes.every(
    (n) => n.status === "completed" || n.status === "failed" || n.status === "skipped"
  );
  if (allDone) {
    const hasFailures = updated.nodes.some((n) => n.status === "failed");
    updated = JobRegistry.update(graphId, {
      status: hasFailures ? "failed" : "completed",
      completedAt: Date.now(),
    });
  }

  return updated;
}

export function failJob(graphId: string, nodeId: string, error: string): JobGraph | null {
  let updated = JobRegistry.updateNode(graphId, nodeId, {
    status: "failed",
    error,
    completedAt: Date.now(),
  });

  if (!updated) return null;

  // Block dependents
  for (const edge of updated.edges.filter((e) => e.from === nodeId && e.type === "depends_on")) {
    updated = JobRegistry.updateNode(graphId, edge.to, { status: "blocked" });
    if (!updated) return null;
  }

  // Check if all done
  const allDone = updated.nodes.every(
    (n) => n.status === "completed" || n.status === "failed" || n.status === "skipped" || n.status === "blocked"
  );
  if (allDone) {
    updated = JobRegistry.update(graphId, {
      status: "failed",
      completedAt: Date.now(),
    });
  }

  return updated;
}

export function skipJob(graphId: string, nodeId: string): JobGraph | null {
  let updated = JobRegistry.updateNode(graphId, nodeId, {
    status: "skipped",
    completedAt: Date.now(),
  });

  if (!updated) return null;

  // Cascade ready nodes (dependents of a skipped node can still run if they have other completed deps)
  const nextReady = getReadyNodes(updated);
  for (const next of nextReady) {
    updated = JobRegistry.updateNode(graphId, next.id, { status: "ready" });
    if (!updated) return null;
  }

  // Check completion
  const allDone = updated.nodes.every(
    (n) => n.status === "completed" || n.status === "failed" || n.status === "skipped" || n.status === "blocked"
  );
  if (allDone) {
    updated = JobRegistry.update(graphId, { status: "completed", completedAt: Date.now() });
  }

  return updated;
}

export function cancelGraph(graphId: string): JobGraph | null {
  const graph = JobRegistry.get(graphId);
  if (!graph) return null;

  const updatedNodes = graph.nodes.map((n) =>
    n.status === "pending" || n.status === "ready" || n.status === "running" || n.status === "blocked"
      ? { ...n, status: "skipped" as JobStatus }
      : n
  );

  return JobRegistry.update(graphId, {
    status: "cancelled",
    completedAt: Date.now(),
    nodes: updatedNodes,
  });
}

export function retryFailedJobs(graphId: string): JobGraph | null {
  const graph = JobRegistry.get(graphId);
  if (!graph) return null;

  const updatedNodes = graph.nodes.map((n) =>
    n.status === "failed" || n.status === "blocked"
      ? { ...n, status: "pending" as JobStatus, error: null, completedAt: null }
      : n
  );

  let updated = JobRegistry.update(graphId, {
    status: "running",
    nodes: updatedNodes,
  });

  if (!updated) return null;

  // Cascade ready
  const ready = getReadyNodes(updated);
  for (const r of ready) {
    updated = JobRegistry.updateNode(graphId, r.id, { status: "ready" });
  }

  return updated;
}

export function getExecutionOrder(graph: JobGraph): JobNode[][] {
  const levels: JobNode[][] = [];
  const visited = new Set<string>();

  function findLevel(nodes: JobNode[]): JobNode[] {
    return nodes.filter(
      (n) => !visited.has(n.id) && n.dependsOn.every((d) => visited.has(d))
    );
  }

  let remaining = [...graph.nodes];
  while (remaining.length > 0) {
    const level = findLevel(remaining);
    if (level.length === 0) break; // circular dependency
    for (const n of level) visited.add(n.id);
    levels.push(level);
    remaining = remaining.filter((n) => !visited.has(n.id));
  }

  return levels;
}
