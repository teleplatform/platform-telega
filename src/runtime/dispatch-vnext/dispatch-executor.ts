import { localDemo } from "../../providers/local/demo.js";
import type { ActionRouteKind } from "../routing/action-route.types.js";
import type { DispatchExecutionOutcome, DispatchExecutionContext } from "./dispatch-execution.types.js";
import type { DispatchPlan } from "./dispatch.types.js";

// PD-W2/A5 — Execution adapter port. Dispatch never calls across unrelated
// Runtime domains directly; it hands a plan to the executor bound to the
// plan's canonical route.
export interface DispatchExecutor {
  readonly execution_route_kind: ActionRouteKind;
  execute<R>(
    plan: DispatchPlan,
    context: DispatchExecutionContext,
  ): Promise<DispatchExecutionOutcome<R>>;
}

export class ExecutionRouteRegistry {
  private readonly executors = new Map<ActionRouteKind, DispatchExecutor>();

  register(executor: DispatchExecutor): void {
    if (this.executors.has(executor.execution_route_kind)) {
      throw new Error(`Executor already registered for route: ${executor.execution_route_kind}`);
    }
    this.executors.set(executor.execution_route_kind, executor);
  }

  resolve(route: ActionRouteKind): DispatchExecutor | undefined {
    return this.executors.get(route);
  }

  list(): DispatchExecutor[] {
    return [...this.executors.values()];
  }
}

// First production-safe executor: the committed offline demo reply path.
// Real execution (the demo provider), deterministic, no network, no mutation.
export class DemoReplyExecutor implements DispatchExecutor {
  readonly execution_route_kind: ActionRouteKind = "provider_bridge";

  async execute<R>(
    plan: DispatchPlan,
    context: DispatchExecutionContext,
  ): Promise<DispatchExecutionOutcome<R>> {
    const message = (context.payload?.message as string) ?? "";
    const reply = await localDemo({ message, model: "local-demo" });
    const now = new Date().toISOString();
    return {
      status: "completed",
      execution_id: plan.run_id,
      target: plan.binding.runtime_target,
      provider_result_ref: plan.provider?.provider_id,
      output_ref: plan.run_id,
      output: reply.output as unknown as R,
      started_at: now,
      completed_at: now,
    };
  }
}