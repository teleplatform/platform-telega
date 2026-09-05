import { ExecutionMonitor, MonitorRun, MonitorFilter } from "./monitorTypes";
import { ExecutionRegistry } from "../execution-runner/executionRegistry.js";
import { TaskRegistry } from "../agent-tasks/taskRegistry.js";
import { GraphRegistry } from "../agent-graph/graphRegistry.js";
import { VerificationRegistry } from "../execution-verifier/verificationRegistry.js";
import { RecoveryPolicyRegistry } from "../recovery-policy/index.js";
import { GovernanceRegistry } from "../governance-engine/governanceRegistry.js";
import { ArtifactRegistry } from "../artifacts/artifactRegistry.js";

function buildRuns(): MonitorRun[] {
  return ExecutionRegistry.getAll().map((run) => {
    const task = TaskRegistry.get(run.taskId);
    const graph = GraphRegistry.getAll().find((g) => g.id === run.graphId);
    const verifs = VerificationRegistry.listByExecution(run.id);
    const recoveryPlans = RecoveryPolicyRegistry.getAll().filter((rp) => rp.executionRunId === run.id);
    const decisions = GovernanceRegistry.getAll().filter((d) => d.executionRunId === run.id);
    const artifacts = ArtifactRegistry.getAll().filter((a) => a.executionRunId === run.id);

    const durationMs = run.startedAt && run.completedAt ? run.completedAt - run.startedAt : null;

    return {
      runId: run.id,
      taskId: run.taskId,
      taskTitle: task?.title || run.taskId,
      graphId: run.graphId,
      graphName: graph?.name || run.graphId,
      status: run.status,
      providerId: run.providerId,
      agentId: run.agentId,
      evidenceCount: run.evidenceRefs.length,
      hasVerification: verifs.length > 0,
      verificationVerdict: verifs.length > 0 ? verifs[0].verdict : null,
      hasRecoveryPlan: recoveryPlans.length > 0,
      recoveryAction: recoveryPlans.length > 0 ? recoveryPlans[0].action : null,
      hasGovernanceDecision: decisions.length > 0,
      governanceVerdict: decisions.length > 0 ? decisions[0].verdict : null,
      hasArtifacts: artifacts.length > 0,
      durationMs,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    };
  }).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
}

export function buildExecutionMonitor(filter?: MonitorFilter): ExecutionMonitor {
  const allRuns = buildRuns();
  const filtered = filter === "running" ? allRuns.filter((r) => r.status === "running")
    : filter === "completed" ? allRuns.filter((r) => r.status === "completed")
    : filter === "failed" ? allRuns.filter((r) => r.status === "failed")
    : allRuns;

  return {
    total: allRuns.length,
    running: allRuns.filter((r) => r.status === "running").length,
    completed: allRuns.filter((r) => r.status === "completed").length,
    failed: allRuns.filter((r) => r.status === "failed").length,
    runs: filtered,
    generatedAt: new Date().toISOString(),
  };
}
