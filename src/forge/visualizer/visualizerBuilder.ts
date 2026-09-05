import { GraphVisualizer, VisualizerNode, VisualizerEdge, VisualizerLevel } from "./visualizerTypes";
import { GraphRegistry, planGraph } from "../agent-graph/index.js";
import { TaskRegistry } from "../agent-tasks/taskRegistry.js";
import { ExecutionRegistry } from "../execution-runner/executionRegistry.js";
import { VerificationRegistry } from "../execution-verifier/verificationRegistry.js";
import { RecoveryPolicyRegistry } from "../recovery-policy/index.js";
import { GovernanceRegistry } from "../governance-engine/governanceRegistry.js";
import { ArtifactRegistry } from "../artifacts/artifactRegistry.js";

export function buildGraphVisualizer(graphId: string): GraphVisualizer | null {
  const graph = GraphRegistry.get(graphId);
  if (!graph) return null;

  const plan = planGraph(graphId);
  const taskIds = graph.nodes.map((n) => n.taskId);
  const executions = ExecutionRegistry.getAll().filter((e) => taskIds.includes(e.taskId));
  const verifications = VerificationRegistry.getAll().filter((v) => taskIds.includes(v.taskId));
  const recoveryPlans = RecoveryPolicyRegistry.getAll().filter((rp) => taskIds.includes(rp.taskId));
  const decisions = GovernanceRegistry.getAll().filter((d) => taskIds.includes(d.taskId ?? ""));
  const artifacts = ArtifactRegistry.getAll().filter((a) => taskIds.includes(a.taskId ?? ""));

  // Build detailed nodes
  const nodes: VisualizerNode[] = graph.nodes.map((node) => {
    const task = TaskRegistry.get(node.taskId);
    const nodeExecs = executions.filter((e) => e.taskId === node.taskId);
    const nodeVerifs = verifications.filter((v) => v.taskId === node.taskId);
    const nodeRecovery = recoveryPlans.filter((rp) => rp.taskId === node.taskId);
    const nodeDecisions = decisions.filter((d) => d.taskId === node.taskId);
    const nodeArtifacts = artifacts.filter((a) => a.taskId === node.taskId);

    const run = nodeExecs.find((e) => e.status === "running" || e.status === "completed" || e.status === "failed");

    // Determine level from plan
    let level = 0;
    for (const [i, lvl] of (plan?.levels || []).entries()) {
      if (lvl.includes(node.taskId)) { level = i + 1; break; }
    }
    if (node.status === "completed" && level === 0) level = (plan?.levels.length || 0);

    return {
      id: node.taskId,
      taskId: node.taskId,
      title: node.title,
      status: node.status,
      level,
      priority: task?.priority || "normal",
      agentId: task?.binding.agentId || null,
      providerId: run?.providerId || null,
      evidenceCount: nodeExecs.reduce((s, e) => s + e.evidenceRefs.length, 0) + nodeVerifs.length,
      hasVerification: nodeVerifs.length > 0,
      hasRecoveryPlan: nodeRecovery.length > 0,
      hasGovernanceDecision: nodeDecisions.length > 0,
      hasArtifacts: nodeArtifacts.length > 0,
    };
  });

  // Build edges
  const edges: VisualizerEdge[] = graph.edges.map((e) => ({
    from: e.from,
    to: e.to,
    type: e.type,
  }));

  // Build levels
  const levels: VisualizerLevel[] = (plan?.levels || []).map((lvlIds, i) => ({
    index: i,
    nodes: nodes.filter((n) => lvlIds.includes(n.taskId)),
    label: `Wave ${i + 1}`,
  }));

  // Collect blockers
  const blockers: string[] = [];
  if (plan?.hasBlockers) {
    for (const bid of plan.blockedTasks) {
      const node = nodes.find((n) => n.taskId === bid);
      if (node) blockers.push(`${node.title} (blocked)`);
    }
  }

  const completedCount = nodes.filter((n) => n.status === "completed").length;
  const failedCount = nodes.filter((n) => n.status === "failed").length;
  const blockedCount = nodes.filter((n) => n.status === "blocked").length;
  const runningCount = nodes.filter((n) => n.status === "running").length;

  return {
    graphId,
    graphName: graph.name,
    graphStatus: graph.status,
    nodes,
    edges,
    levels,
    blockers,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    levelCount: levels.length,
    completedCount,
    failedCount,
    blockedCount,
    runningCount,
    generatedAt: new Date().toISOString(),
  };
}
