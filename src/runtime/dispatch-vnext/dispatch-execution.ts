import { resolveActor } from "../../core/authz/actor.js";
import { resolveActorMode } from "../../core/authz/modes.js";
import { permissionResolverV2 } from "../../core/authz/permissionResolver.js";
import type { PermissionContext } from "../../types/authz.js";
import { getTargetStatus } from "../availability/availability-registry.js";
import type { AvailabilityStatus, RuntimeTarget } from "../availability/availability.types.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { DispatchExecutor } from "./dispatch-executor.js";
import { ExecutionRouteRegistry } from "./dispatch-executor.js";
import type {
  DispatchExecutionOutcome,
  DispatchExecutionContext,
  DispatchResult,
  DispatchExecutionState,
} from "./dispatch-execution.types.js";
import type { DispatchPlan } from "./dispatch.types.js";

// PD-W2/A5 — Safe execution coordinator. Planning authorization does NOT live
// forever: before any consequential execution the trusted identity is re-verified
// and the canonical authz re-checked; availability is re-checked against live
// truth; and every plan executes at most once.

export type AuthorizationRecheckDecision = "allow" | "deny" | "needs_approval" | "auth_missing";

export interface AuthorizationRecheck {
  recheck(
    plan: DispatchPlan,
    context: DispatchExecutionContext,
  ): Promise<AuthorizationRecheckDecision> | AuthorizationRecheckDecision;
}

export interface AvailabilityRecheck {
  check(target: RuntimeTarget): AvailabilityStatus | undefined;
}

export interface DispatchExecutionPorts {
  authorizationRecheck?: AuthorizationRecheck;
  availabilityRecheck?: AvailabilityRecheck;
}

type BlockedExecutionState = "denied" | "approval_required" | "unavailable";

export class DispatchExecutionCoordinator {
  private readonly ledger = new Map<string, DispatchResult<unknown>>();

  constructor(
    private readonly routes: ExecutionRouteRegistry,
    private readonly ports: DispatchExecutionPorts = {},
  ) {}

  async safeExecute<R>(
    plan: DispatchPlan,
    context: DispatchExecutionContext,
  ): Promise<DispatchResult<R>> {
    const existing = this.ledger.get(plan.run_id);
    if (existing) {
      return existing as DispatchResult<R>;
    }

    const authorization = await this.reauthorize(plan, context);
    if (authorization !== "allow") {
      const blocked: BlockedExecutionState =
        authorization === "needs_approval" ? "approval_required" : "denied";
      const reasonCode =
        authorization === "needs_approval"
          ? "APPROVAL_REQUIRED"
          : authorization === "deny"
            ? "FORBIDDEN"
            : "AUTH_REQUIRED";
      return this.storeBlocked(plan, blocked, reasonCode);
    }

    if (this.availabilityBlocked(plan)) {
      return this.storeBlocked(plan, "unavailable", "TARGET_BLOCKED");
    }

    const executor = this.routes.resolve(plan.binding.execution_route_kind);
    if (!executor) {
      return this.storeBlocked(plan, "unavailable", "EXECUTOR_UNAVAILABLE");
    }

    await this.recordDispatchStarted(plan);
    await this.recordExecutionStarted(plan);

    const outcome = await this.runExecutor<R>(executor, plan, context);

    await this.recordExecutionFinished(plan, outcome.status);

    const result: DispatchResult<R> = {
      dispatch_id: plan.run_id,
      plan_id: plan.run_id,
      execution_state: outcome.status,
      outcome,
      evidence_refs: [plan.run_id, plan.trace_id],
      reasons: outcome.status === "failed" && outcome.error ? [outcome.error.message] : [],
    };
    this.ledger.set(plan.run_id, result);
    return result;
  }

  private async reauthorize(
    plan: DispatchPlan,
    context: DispatchExecutionContext,
  ): Promise<AuthorizationRecheckDecision> {
    if (this.ports.authorizationRecheck) {
      return this.ports.authorizationRecheck.recheck(plan, context);
    }

    const actor = resolveActor(context.subject);
    if (!actor || actor.id !== plan.authorization.actor_id) {
      return "auth_missing";
    }

    const permission: PermissionContext = {
      actor_id: actor.id,
      actor_mode: resolveActorMode(actor),
      role: actor.role,
      action: context.authz.action,
      resource_kind: context.authz.resource_kind,
      resource_id: context.authz.resource_id,
      is_owner: context.authz.is_owner,
      visibility_scope: context.authz.visibility_scope,
    };
    const decision = permissionResolverV2.resolve(permission);
    if (decision.decision === "deny") return "deny";
    if (decision.decision === "needs_approval") return "needs_approval";
    return "allow";
  }

  private availabilityBlocked(plan: DispatchPlan): boolean {
    const target = plan.binding.runtime_target;
    if (!target) return false;
    const status = this.ports.availabilityRecheck
      ? this.ports.availabilityRecheck.check(target)
      : getTargetStatus(target);
    return status !== "online";
  }

  private async runExecutor<R>(
    executor: DispatchExecutor,
    plan: DispatchPlan,
    context: DispatchExecutionContext,
  ): Promise<DispatchExecutionOutcome<R>> {
    const now = new Date().toISOString();
    try {
      const outcome = await executor.execute<R>(plan, context);
      if (outcome.status === "completed" && outcome.output === undefined && outcome.output_ref === undefined) {
        return {
          ...outcome,
          status: "failed",
          error: { message: "ambiguous outcome: completed without output" },
        };
      }
      return outcome;
    } catch (e: any) {
      return {
        status: "failed",
        execution_id: plan.run_id,
        target: plan.binding.runtime_target,
        started_at: now,
        completed_at: new Date().toISOString(),
        error: {
          message: e?.message ?? "executor threw",
          failure_type: e?.failure_type,
        },
      };
    }
  }

  private storeBlocked<R>(
    plan: DispatchPlan,
    state: BlockedExecutionState,
    reasonCode: string,
  ): DispatchResult<R> {
    const result: DispatchResult<R> = {
      dispatch_id: plan.run_id,
      plan_id: plan.run_id,
      execution_state: state,
      evidence_refs: [plan.run_id, plan.trace_id],
      reason_code: reasonCode,
      reasons: [reasonCode],
    };
    this.ledger.set(plan.run_id, result);
    return result;
  }

  private async recordDispatchStarted(plan: DispatchPlan): Promise<void> {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(plan.run_id, "dispatch_started"),
      trace_id: plan.trace_id,
      job_id: "dispatch",
      run_id: plan.run_id,
      type: "dispatch_started",
      timestamp: new Date().toISOString(),
      payload: {
        run_id: plan.run_id,
        route: plan.binding.execution_route_kind,
        target: plan.binding.runtime_target ?? null,
        provider: plan.provider?.provider_id ?? null,
      },
    });
  }

  private async recordExecutionStarted(plan: DispatchPlan): Promise<void> {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(plan.run_id, "execution_started"),
      trace_id: plan.trace_id,
      job_id: "dispatch",
      run_id: plan.run_id,
      type: "execution_started",
      timestamp: new Date().toISOString(),
      payload: { run_id: plan.run_id },
    });
  }

  private async recordExecutionFinished(plan: DispatchPlan, status: DispatchExecutionState): Promise<void> {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(plan.run_id, "execution_finished"),
      trace_id: plan.trace_id,
      job_id: "dispatch",
      run_id: plan.run_id,
      type: "execution_finished",
      timestamp: new Date().toISOString(),
      lifecycle_state: status,
      payload: { run_id: plan.run_id, status },
    });
  }
}