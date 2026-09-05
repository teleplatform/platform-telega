import { ResumePlan } from "./recoveryTypes";
import { getLastSafePoint, listRecoveryPoints } from "./recoveryPoint";
import { JobRegistry, getExecutionOrder } from "../job/index.js";

export function buildResumePlan(graphId: string, recoveryPointId?: string): ResumePlan | null {
  const graph = JobRegistry.get(graphId);
  if (!graph) return null;

  const point = recoveryPointId
    ? listRecoveryPoints(graphId).find((p) => p.id === recoveryPointId)
    : getLastSafePoint(graphId);

  // Find failed/blocked jobs that need retry
  const jobsToRetry = graph.nodes
    .filter((n) => n.status === "failed" || n.status === "blocked")
    .map((n) => n.id);

  // Find jobs that completed after the recovery point's timestamp
  const jobsToSkip = graph.nodes
    .filter((n) => n.status === "completed" && (!point || (n.completedAt && n.completedAt > point.createdAt)))
    .map((n) => n.id);

  // How many levels were completed
  const order = getExecutionOrder(graph);
  const completedLevels = order.findIndex((level) =>
    level.some((n) => n.status === "failed" || n.status === "blocked" || n.status === "pending")
  );

  return {
    graphId,
    recoveryPointId: point?.id || null,
    completedLevels: completedLevels >= 0 ? completedLevels : order.length,
    jobsToRetry,
    jobsToSkip,
  };
}

export function resumeGraph(graphId: string): boolean {
  const plan = buildResumePlan(graphId);
  if (!plan) return false;

  // Reset failed and blocked jobs to pending
  for (const jobId of plan.jobsToRetry) {
    JobRegistry.updateNode(graphId, jobId, {
      status: "pending",
      error: null,
      completedAt: null,
    });
  }

  // Set graph back to running
  const graph = JobRegistry.get(graphId);
  if (graph && (graph.status === "failed" || graph.status === "cancelled")) {
    JobRegistry.update(graphId, { status: "running" });
  }

  return true;
}
