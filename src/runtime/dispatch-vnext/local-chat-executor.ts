import { chat } from "../../providers/local/chat.js";
import type { ChatRequest, ChatResponse } from "../../types/chat.js";
import type { ActionRouteKind } from "../routing/action-route.types.js";
import type { DispatchExecutionOutcome, DispatchExecutionContext } from "./dispatch-execution.types.js";
import type { DispatchExecutor } from "./dispatch-executor.js";
import type { DispatchPlan } from "./dispatch.types.js";

// PD-W3/B4-B — Executor for the authenticated local chat slice. Owns the
// transient transport only: it invokes the canonical localChat transport leaf
// and returns the real provider/model/usage/output facts. It does NOT select
// providers, fall back across providers, run any routing, or mutate authority.
// On transport failure the coordinator records an honest failed outcome (no
// synthesized completion, no silent offline fallback).
export class LocalChatExecutor implements DispatchExecutor {
  readonly execution_route_kind: ActionRouteKind = "provider_http";

  async execute<R>(
    plan: DispatchPlan,
    context: DispatchExecutionContext,
  ): Promise<DispatchExecutionOutcome<R>> {
    const payload = context.payload ?? {};

    const request: ChatRequest = {
      message: (payload.message as string) ?? "",
      model: (payload.model as string) ?? plan.provider?.provider_id ?? "local:local-chat",
      system: typeof payload.system === "string" ? payload.system : undefined,
      meta: { provider: "local" },
    };

    const transportResult = await chat(request);

    const now = new Date().toISOString();
    return {
      status: "completed",
      execution_id: plan.run_id,
      target: plan.binding.runtime_target,
      provider_result_ref: plan.provider?.provider_id,
      output_ref: plan.run_id,
      output: transportResult as unknown as R,
      started_at: now,
      completed_at: now,
    };
  }
}