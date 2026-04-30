import type { ExecutionNode, SkillUnit } from "../../fsgr-contracts/src/index.js";
import type { ExecutionHandler, ExecutionHandlerResult, ExecutionHandlerContext } from "./handlers.js";
import type { ValidatorOutcome, ValidatorRegistry } from "./validators.js";
import { runValidators } from "./validators.js";
import { transitionNodeStatus } from "./statusTransitions.js";

export interface NodeRunResult {
  node_id: string;
  status: "completed" | "failed";
  outputs: ExecutionHandlerResult["outputs"];
  validator_results: ValidatorOutcome[];
  error?: { code: string; message: string };
  summary?: string;
}

export async function runNode(
  node: ExecutionNode,
  skill: SkillUnit,
  handler: ExecutionHandler,
  validatorRegistry: ValidatorRegistry,
  context: { run_id: string; trace_id?: string; actor_mode?: string }
): Promise<NodeRunResult> {
  if (!transitionNodeStatus(node, "running")) {
    return { node_id: node.node_id, status: "failed", outputs: [], validator_results: [], error: { code: "INVALID_TRANSITION", message: `Cannot transition from ${node.status} to running` } };
  }

  const handlerContext: ExecutionHandlerContext = {
    run_id: context.run_id,
    node_id: node.node_id,
    skill_id: node.skill_id,
    actor_mode: context.actor_mode,
    input_refs: node.input_refs,
    trace_id: context.trace_id,
  };

  try {
    const handlerResult = await handler(handlerContext);
    const validator_results = runValidators(node, handlerResult, validatorRegistry);
    const hasFailures = validator_results.some((r) => r.status === "failed");

    if (hasFailures) {
      return { node_id: node.node_id, status: "failed", outputs: handlerResult.outputs, validator_results, error: { code: "VALIDATION_FAILED", message: "Output validation failed" }, summary: handlerResult.summary };
    }

    if (!transitionNodeStatus(node, "completed")) {
      return { node_id: node.node_id, status: "failed", outputs: handlerResult.outputs, validator_results, error: { code: "INVALID_TRANSITION", message: `Cannot transition to completed` }, summary: handlerResult.summary };
    }

    return { node_id: node.node_id, status: "completed", outputs: handlerResult.outputs, validator_results, summary: handlerResult.summary };
  } catch (e: any) {
    transitionNodeStatus(node, "failed");
    return { node_id: node.node_id, status: "failed", outputs: [], validator_results: [], error: { code: e.code ?? "EXECUTION_ERROR", message: e.message ?? String(e) } };
  }
}
