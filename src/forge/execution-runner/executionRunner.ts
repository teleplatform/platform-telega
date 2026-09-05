import { ExecutionRun, RunPolicy } from "./executionTypes";
import { ExecutionRegistry } from "./executionRegistry";
import { TaskRegistry } from "../agent-tasks/taskRegistry.js";
import { GovernanceRegistry } from "../governance/outcomeRegistry.js";

const DEFAULT_POLICY: RunPolicy = { maxRetries: 3, timeoutMs: 120000, recordEvidence: true };

function writeEvidence(kind: string, source: string, summary: string, details: Record<string, unknown>): string {
  const outcome = GovernanceRegistry.record(kind as any, source as any, "info", summary, details, []);
  return outcome.outcomeId;
}

export async function startExecution(
  taskId: string,
  graphId: string,
  agentId?: string,
  providerId?: string
): Promise<ExecutionRun | null> {
  const task = TaskRegistry.get(taskId);
  if (!task) return null;
  if (task.status !== "pending" && task.status !== "ready") return null;

  // Create run
  const run = ExecutionRegistry.create(taskId, graphId, agentId, providerId);

  // Update task status
  TaskRegistry.update(taskId, { status: "running" });

  // Write evidence
  if (DEFAULT_POLICY.recordEvidence) {
    const evRef = writeEvidence("job_running", "execution", `Started execution of "${task.title}"`, {
      runId: run.id, taskId, graphId, agentId, providerId,
    });
    ExecutionRegistry.addEvidence(run.id, evRef);
  }

  // Update run status
  return ExecutionRegistry.update(run.id, { status: "running", startedAt: Date.now() });
}

export async function completeExecution(runId: string, result?: string): Promise<ExecutionRun | null> {
  const run = ExecutionRegistry.get(runId);
  if (!run) return null;
  if (run.status !== "running") return null;

  const now = Date.now();
  const updated = ExecutionRegistry.update(runId, { status: "completed", result: result || null, completedAt: now });
  if (!updated) return null;

  // Update task
  TaskRegistry.update(run.taskId, { status: "completed", result: result || null, completedAt: now });

  // Write evidence
  if (DEFAULT_POLICY.recordEvidence) {
    const task = TaskRegistry.get(run.taskId);
    const evRef = writeEvidence("job_completed", "execution", `Completed: "${task?.title || run.taskId}"`, {
      runId, taskId: run.taskId, graphId: run.graphId,
    });
    ExecutionRegistry.addEvidence(runId, evRef);
  }

  return ExecutionRegistry.get(runId);
}

export async function failExecution(runId: string, error: string): Promise<ExecutionRun | null> {
  const run = ExecutionRegistry.get(runId);
  if (!run) return null;
  if (run.status !== "running") return null;

  const now = Date.now();
  const updated = ExecutionRegistry.update(runId, { status: "failed", error, completedAt: now });
  if (!updated) return null;

  // Update task
  TaskRegistry.update(run.taskId, { status: "failed", error, completedAt: now });

  // Write evidence
  if (DEFAULT_POLICY.recordEvidence) {
    const task = TaskRegistry.get(run.taskId);
    const evRef = writeEvidence("job_failed", "execution", `Failed: "${task?.title || run.taskId}" — ${error}`, {
      runId, taskId: run.taskId, graphId: run.graphId, error,
    });
    ExecutionRegistry.addEvidence(runId, evRef);
  }

  return ExecutionRegistry.get(runId);
}

export async function cancelExecution(runId: string): Promise<ExecutionRun | null> {
  const run = ExecutionRegistry.get(runId);
  if (!run) return null;
  if (run.status === "completed") return null;

  const updated = ExecutionRegistry.update(runId, { status: "cancelled", completedAt: Date.now() });
  if (!updated) return null;

  TaskRegistry.update(run.taskId, { status: "cancelled" });

  return ExecutionRegistry.get(runId);
}
