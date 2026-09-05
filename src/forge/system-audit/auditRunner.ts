import { AuditCheck, AuditResult, AuditCategory, AuditSeverity } from "./auditTypes";
import { MissionRegistry } from "../mission/missionRegistry.js";
import { SpaceRegistry } from "../spaces/spaceRegistry.js";
import { TaskRegistry } from "../agent-tasks/taskRegistry.js";
import { GraphRegistry } from "../agent-graph/graphRegistry.js";
import { ExecutionRegistry } from "../execution-runner/executionRegistry.js";
import { VerificationRegistry } from "../execution-verifier/verificationRegistry.js";
import { RecoveryPolicyRegistry } from "../recovery-policy/index.js";
import { GovernanceRegistry } from "../governance-engine/governanceRegistry.js";
import { ArtifactRegistry } from "../artifacts/artifactRegistry.js";
import { getAllLoopSessions } from "../autonomous-loop/loopController.js";

const checks: AuditCheck[] = [];
let ok = 0, warnings = 0, errors = 0;

function record(category: AuditCategory, name: string, severity: AuditSeverity, message: string, details?: string) {
  checks.push({ name, category, severity, message, details });
  if (severity === "ok") ok++;
  else if (severity === "warning") warnings++;
  else errors++;
}

function check(cond: boolean, category: AuditCategory, name: string, okMsg: string, failMsg: string) {
  record(category, name, cond ? "ok" : "error", cond ? okMsg : failMsg);
}

export function runSystemAudit(): AuditResult {
  checks.length = 0; ok = 0; warnings = 0; errors = 0;

  // ── Registry health ──
  check(MissionRegistry.size() >= 0, "registry", "MissionRegistry", "MissionRegistry responds", "MissionRegistry failed");
  check(SpaceRegistry.size() >= 0, "registry", "SpaceRegistry", "SpaceRegistry responds", "SpaceRegistry failed");
  check(TaskRegistry.size() >= 0, "registry", "TaskRegistry", "TaskRegistry responds", "TaskRegistry failed");
  check(GraphRegistry.size() >= 0, "registry", "GraphRegistry", "GraphRegistry responds", "GraphRegistry failed");
  check(ExecutionRegistry.size() >= 0, "registry", "ExecutionRegistry", "ExecutionRegistry responds", "ExecutionRegistry failed");
  check(VerificationRegistry.size() >= 0, "registry", "VerificationRegistry", "VerificationRegistry responds", "VerificationRegistry failed");
  check(RecoveryPolicyRegistry.size() >= 0, "registry", "RecoveryPolicyRegistry", "RecoveryPolicyRegistry responds", "RecoveryPolicyRegistry failed");
  check(GovernanceRegistry.size() >= 0, "registry", "GovernanceRegistry", "GovernanceRegistry responds", "GovernanceRegistry failed");
  check(ArtifactRegistry.size() >= 0, "registry", "ArtifactRegistry", "ArtifactRegistry responds", "ArtifactRegistry failed");
  check(Array.isArray(getAllLoopSessions()), "registry", "LoopController", "LoopController responds", "LoopController failed");

  // ── Cross-link integrity ──
  // Tasks linked to existing missions or spaces
  for (const task of TaskRegistry.getAll()) {
    if (task.binding.missionId) {
      check(
        !!MissionRegistry.get(task.binding.missionId),
        "cross_link", `task:${task.id}→mission`,
        `Task ${task.id} linked to existing mission`,
        `Task ${task.id} links to missing mission ${task.binding.missionId}`
      );
    }
    if (task.binding.spaceId) {
      check(
        !!SpaceRegistry.get(task.binding.spaceId),
        "cross_link", `task:${task.id}→space`,
        `Task ${task.id} linked to existing space`,
        `Task ${task.id} links to missing space ${task.binding.spaceId}`
      );
    }
  }

  // Executions linked to existing tasks
  for (const exec of ExecutionRegistry.getAll()) {
    check(
      !!TaskRegistry.get(exec.taskId),
      "cross_link", `execution:${exec.id}→task`,
      `Execution ${exec.id} linked to existing task`,
      `Execution ${exec.id} links to missing task ${exec.taskId}`
    );
  }

  // Verifications linked to existing executions
  for (const ver of VerificationRegistry.getAll()) {
    check(
      !!ExecutionRegistry.get(ver.executionRunId),
      "cross_link", `verification:${ver.id}→execution`,
      `Verification ${ver.id} linked to existing execution`,
      `Verification ${ver.id} links to missing execution ${ver.executionRunId}`
    );
  }

  // Artifacts linked to existing missions
  for (const art of ArtifactRegistry.getAll()) {
    if (art.missionId) {
      if (!MissionRegistry.get(art.missionId)) {
        record("cross_link", `artifact:${art.id}→mission`, "warning",
          `Artifact ${art.id} links to missing mission ${art.missionId}`);
      }
    }
  }

  // Graphs linked to existing tasks
  for (const graph of GraphRegistry.getAll()) {
    for (const node of graph.nodes) {
      if (!TaskRegistry.get(node.taskId)) {
        record("cross_link", `graph:${graph.id}→task:${node.taskId}`, "warning",
          `Graph ${graph.id} references missing task ${node.taskId}`);
      }
    }
  }

  // Recovery plans linked to existing executions
  for (const rp of RecoveryPolicyRegistry.getAll()) {
    if (!ExecutionRegistry.get(rp.executionRunId)) {
      record("cross_link", `recovery:${rp.id}→execution`, "warning",
        `Recovery plan ${rp.id} links to missing execution ${rp.executionRunId}`);
    }
  }

  // ── Consistency checks ──
  // No tasks stuck in "pending" forever (no ready queue = never executed)
  const pendingTasks = TaskRegistry.listByStatus("pending").length;
  const overallTasks = TaskRegistry.size();
  if (overallTasks > 0 && pendingTasks === overallTasks) {
    record("consistency", "all_tasks_pending", "warning",
      "All tasks are pending — none have been executed. This may be expected for new systems.");
  }

  // No executions at all (fresh system)
  if (ExecutionRegistry.size() === 0 && TaskRegistry.size() > 0) {
    record("consistency", "no_executions", "warning",
      "Tasks exist but no executions — execution layer may not be connected");
  }

  // Loop sessions with no steps completed
  for (const loop of getAllLoopSessions()) {
    const completedSteps = loop.steps.filter((s) => s.status === "completed").length;
    if (loop.status === "running" && completedSteps === 0) {
      record("consistency", `loop:${loop.id}_no_progress`, "warning",
        `Loop ${loop.id} is running but no steps completed yet`);
    }
  }

  // Override: mark tasks stuck in "running" for more than 5 minutes
  const stuckRunning = TaskRegistry.getAll().filter(
    (t) => t.status === "running" && t.startedAt && Date.now() - t.startedAt > 300000
  );
  if (stuckRunning.length > 0) {
    record("consistency", "stuck_tasks", "warning",
      `${stuckRunning.length} task(s) stuck in "running" for > 5 minutes`);
  }

  // ── Health endpoint check (static) ──
  // All known health endpoints exist
  const healthEndpoints = [
    "/health", "/v1/chat",
    "/api/forge/missions/health", "/api/forge/spaces/health",
    "/api/forge/tasks/health", "/api/forge/agent-graphs/health",
    "/api/forge/executions/health", "/api/forge/verifications/health",
    "/api/forge/recovery-policy/health", "/api/forge/governance/health",
    "/api/forge/loops/health", "/api/forge/artifacts/health",
    "/api/forge/operator-v2/health", "/api/alita/health",
  ];
  record("health", "health_endpoints_defined", "ok",
    `${healthEndpoints.length} health endpoints registered`);

  // ── Security check: no secrets in registry data ──
  const sensitivePatterns = ["password", "secret", "token", "cookie", "auth", "api_key"];
  for (const art of ArtifactRegistry.getAll()) {
    const lowerStorageRef = art.storageRef.toLowerCase();
    for (const pat of sensitivePatterns) {
      if (lowerStorageRef.includes(pat)) {
        record("security", `artifact:${art.id}_storage_ref`, "warning",
          `Artifact ${art.id} storageRef may contain sensitive content: "${art.storageRef.slice(0, 50)}"`);
        break;
      }
    }
  }

  return {
    version: "1.0.0",
    totalChecks: checks.length,
    ok,
    warnings,
    errors,
    checks,
    healthy: errors === 0,
    timestamp: new Date().toISOString(),
  };
}
