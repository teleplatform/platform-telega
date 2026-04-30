import type { ExecutionNode, RunLedger } from "../../fsgr-contracts/src/index.js";
import type { FsgrRuntime } from "../runtime/initRuntime.js";
import { getReadyNodes, areDependenciesSatisfied } from "./dependencyResolver.js";
import { runNode, type NodeRunResult } from "./nodeRunner.js";
import { buildRetryDecision } from "./retries.js";
import { resolveFallbackSkill, applyFallbackToNode } from "./fallback.js";
import { transitionNodeStatus, deriveRunStatus } from "./statusTransitions.js";
import { buildContextCapsule } from "../capsule/capsuleBuilder.js";

export interface ExecutorContext {
  maxConcurrency?: number;
  maxIterations?: number;
}

export async function executeRun(
  runtime: FsgrRuntime,
  runId: string,
  ctx?: ExecutorContext
): Promise<{ status: string; completed: number; failed: number }> {
  const maxConcurrency = ctx?.maxConcurrency ?? 1;
  const maxIterations = ctx?.maxIterations ?? 100;
  let iterations = 0;

  const ledger = runtime.ledgerStore.getRun(runId);
  if (!ledger) throw new Error(`Run ${runId} not found`);

  let nodes = runtime.ledgerStore.getNodes(runId);

  while (iterations < maxIterations) {
    iterations++;

    // Update waiting_dependency nodes whose dependencies are satisfied
    for (const node of nodes) {
      if (node.status === "waiting_dependency" && areDependenciesSatisfied(node, nodes)) {
        node.status = "ready";
        runtime.ledgerStore.updateNode(node.node_id, { status: "ready" });
        runtime.ledgerStore.appendEvent({ run_id: runId, node_id: node.node_id, event_type: "node.ready" as any, payload: { node_id: node.node_id } });
      }
    }

    // Get ready nodes (exclude already completed/failed)
    const readyNodes = getReadyNodes(nodes).filter((n) => n.status !== "completed" && n.status !== "failed");
    if (readyNodes.length === 0) {
      const allTerminal = nodes.every((n) => n.status === "completed" || n.status === "failed" || n.status === "blocked");
      if (allTerminal) break;
      const hasActive = nodes.some((n) => n.status === "running" || n.status === "waiting_dependency");
      if (!hasActive) break;
      continue;
    }

    // Execute batch
    const batch = readyNodes.slice(0, maxConcurrency);

    for (const node of batch) {
      const skill = runtime.skillRegistry.getSkillById(node.skill_id);
      if (!skill) {
        node.status = "failed";
        runtime.ledgerStore.updateNode(node.node_id, { status: "failed" });
        runtime.ledgerStore.appendEvent({ run_id: runId, node_id: node.node_id, event_type: "node.failed", payload: { node_id: node.node_id, reason: "skill_not_found" } });
        continue;
      }

      const handler = runtime.handlerRegistry.get(node.skill_id);
      if (!handler) {
        node.status = "failed";
        runtime.ledgerStore.updateNode(node.node_id, { status: "failed" });
        runtime.ledgerStore.appendEvent({ run_id: runId, node_id: node.node_id, event_type: "node.failed", payload: { node_id: node.node_id, reason: "handler_not_found" } });
        continue;
      }

      // Emit node.started
      runtime.ledgerStore.appendEvent({ run_id: runId, node_id: node.node_id, event_type: "node.started", payload: { node_id: node.node_id, skill_id: node.skill_id } });

      // Run the node
      const result = await runNode(node, skill, handler, runtime.validatorRegistry, { run_id: runId, trace_id: ledger.trace_id, actor_mode: ledger.actor_mode });

      if (result.status === "completed") {
        runtime.ledgerStore.updateNode(node.node_id, { status: "completed" });
        runtime.ledgerStore.appendEvent({ run_id: runId, node_id: node.node_id, event_type: "node.completed", payload: { node_id: node.node_id, summary: result.summary } });
        for (const output of result.outputs) {
          const artifactId = `artifact_${runId}_${node.node_id}_${output.ref}`;
          runtime.ledgerStore.createArtifact({
            artifact_id: artifactId,
            run_id: runId,
            node_id: node.node_id,
            artifact_kind: output.kind,
            title: `${node.title} - ${output.ref}`,
            storage_ref: `node://${node.node_id}/${output.ref}`,
            validator_results: result.validator_results.map((v) => ({ validator: v.validator, status: v.status, summary: v.summary })),
          });
        }
      } else {
        const errorCode = result.error?.code ?? "UNKNOWN";
        const retryDecision = buildRetryDecision(errorCode, skill.retry_policy, node.retry_count);

        if (retryDecision.should_retry) {
          node.retry_count++;
          node.status = "ready";
          runtime.ledgerStore.updateNode(node.node_id, { status: "ready", retry_count: node.retry_count });
          runtime.ledgerStore.appendEvent({ run_id: runId, node_id: node.node_id, event_type: "node.retry_scheduled", payload: { node_id: node.node_id, retry_count: node.retry_count, delay_ms: retryDecision.delay_ms } });
        } else {
          const fallbackSkillId = resolveFallbackSkill(node, runtime.skillRegistry);
          if (fallbackSkillId) {
            applyFallbackToNode(node, fallbackSkillId);
            runtime.ledgerStore.updateNode(node.node_id, { skill_id: fallbackSkillId, retry_count: 0 });
            runtime.ledgerStore.appendEvent({ run_id: runId, node_id: node.node_id, event_type: "node.fallback_used", payload: { node_id: node.node_id, fallback_skill_id: fallbackSkillId } });
          } else {
            node.status = "failed";
            runtime.ledgerStore.updateNode(node.node_id, { status: "failed" });
            runtime.ledgerStore.appendEvent({ run_id: runId, node_id: node.node_id, event_type: "node.failed", payload: { node_id: node.node_id, error: result.error } });
          }
        }
      }
    }

    // Reload nodes
    nodes = runtime.ledgerStore.getNodes(runId);

    // Update run status
    const newRunStatus = deriveRunStatus(nodes, ledger.status);
    if (newRunStatus !== ledger.status) {
      runtime.ledgerStore.updateRun(runId, { status: newRunStatus });
      runtime.ledgerStore.appendEvent({ run_id: runId, event_type: `run.${newRunStatus}` as any, payload: { status: newRunStatus } });
    }

    // Rebuild capsule
    const events = runtime.ledgerStore.getEvents(runId);
    const capsule = buildContextCapsule(runId, { ...ledger, status: newRunStatus }, nodes, events);
    runtime.ledgerStore.saveCapsule({ capsule_id: capsule.capsule_id, run_id: runId, capsule_json: JSON.stringify(capsule) });
    runtime.ledgerStore.appendEvent({ run_id: runId, event_type: "capsule.updated", payload: { capsule_id: capsule.capsule_id } });
  }

  const completed = nodes.filter((n) => n.status === "completed").length;
  const failed = nodes.filter((n) => n.status === "failed" || n.status === "blocked").length;

  // Final status update
  const finalStatus = deriveRunStatus(nodes, "running");
  runtime.ledgerStore.updateRun(runId, { status: finalStatus });
  runtime.ledgerStore.appendEvent({ run_id: runId, event_type: `run.${finalStatus}` as any, payload: { status: finalStatus } });

  return { status: finalStatus, completed, failed };
}

export async function resumeRunExecution(
  runtime: FsgrRuntime,
  runId: string
): Promise<{ status: string; completed: number; failed: number }> {
  const ledger = runtime.ledgerStore.getRun(runId);
  if (!ledger) throw new Error(`Run ${runId} not found`);

  if (ledger.status !== "paused" && ledger.status !== "degraded") {
    return { status: ledger.status, completed: ledger.completed_node_ids.length, failed: ledger.failed_node_ids.length };
  }

  runtime.ledgerStore.updateRun(runId, { status: "running" });
  runtime.ledgerStore.appendEvent({ run_id: runId, event_type: "run.resumed", payload: { from: ledger.status } });

  return executeRun(runtime, runId);
}

export async function retryNodeExecution(
  runtime: FsgrRuntime,
  runId: string,
  nodeId: string
): Promise<{ status: string; error?: string }> {
  const nodes = runtime.ledgerStore.getNodes(runId);
  const node = nodes.find((n) => n.node_id === nodeId);
  if (!node) return { status: "error", error: `Node ${nodeId} not found` };
  if (node.status !== "failed") return { status: "error", error: `Node ${nodeId} is not failed (status: ${node.status})` };

  node.retry_count = 0;
  node.status = "ready";
  runtime.ledgerStore.updateNode(nodeId, { status: "ready", retry_count: 0 });
  runtime.ledgerStore.appendEvent({ run_id: runId, node_id: nodeId, event_type: "node.retry_scheduled", payload: { node_id: nodeId } });

  return { status: "scheduled" };
}
