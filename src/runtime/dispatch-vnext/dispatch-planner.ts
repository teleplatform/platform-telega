import { CapabilityRegistry } from "../capability-vnext/capability-registry.js";
import type { CapabilityKind } from "../capability-vnext/capability.types.js";
import { getTargetStatus } from "../availability/availability-registry.js";
import { resolveActor } from "../../core/authz/actor.js";
import { resolveActorMode } from "../../core/authz/modes.js";
import { permissionResolverV2 } from "../../core/authz/permissionResolver.js";
import type { PermissionContext } from "../../types/authz.js";
import type { ProviderDecision, ProviderRouteRequest } from "../provider/provider-decision.js";
import { DispatchError } from "./dispatch-errors.js";
import type { ExecutionBindingRegistry, CapabilityExecutionBinding } from "./dispatch-bindings.js";
import type {
  DispatchPlan,
  DispatchPlanProvider,
  DispatchRequest,
} from "./dispatch.types.js";

export interface DispatchProviderSelector {
  select(
    request: ProviderRouteRequest,
    activeTier?: string,
    activeProviderId?: string,
  ): Promise<ProviderDecision>;
}

export interface DispatchAuthorityPorts {
  capabilityRegistry?: CapabilityRegistry;
  bindingRegistry: ExecutionBindingRegistry;
  providerSelector?: DispatchProviderSelector;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export class DispatchPlanner {
  private readonly capabilityRegistry: CapabilityRegistry;

  constructor(private readonly ports: DispatchAuthorityPorts) {
    this.capabilityRegistry = ports.capabilityRegistry ?? new CapabilityRegistry();
  }

  async planDispatch(request: DispatchRequest): Promise<DispatchPlan> {
    this.validateRequest(request);

    const capability = this.resolveCapability(request.capability_kind);

    const authorization = this.authorize(request);

    const binding = this.resolveBinding(request.capability_kind);

    const availability = this.checkAvailability(binding);

    const provider = await this.selectProvider(request, binding);

    return {
      run_id: request.run_id,
      trace_id: request.trace_id,
      status: "planned",
      capability: {
        capability_id: capability.capability_id,
        kind: capability.kind,
        trust_level: capability.trust_level,
      },
      authorization,
      binding: {
        execution_route_kind: binding.execution_route_kind,
        runtime_target: binding.runtime_target,
      },
      availability,
      provider,
      evidence_refs: [request.run_id, request.trace_id],
    };
  }

  private validateRequest(request: DispatchRequest): void {
    if (!isNonEmptyString(request.run_id) || !isNonEmptyString(request.trace_id)) {
      throw new DispatchError("DISPATCH_INVALID_REQUEST", "run_id and trace_id are required");
    }
    if (!isNonEmptyString(request.subject)) {
      throw new DispatchError("DISPATCH_INVALID_REQUEST", "authenticated subject is required");
    }
    if (!request.intent || !request.authz) {
      throw new DispatchError("DISPATCH_INVALID_REQUEST", "intent and authz context are required");
    }
  }

  private resolveCapability(kind: CapabilityKind) {
    try {
      return this.capabilityRegistry.resolve(kind);
    } catch {
      const matches = this.capabilityRegistry.list().filter((descriptor) => descriptor.kind === kind);
      if (matches.length === 0) {
        throw new DispatchError("CAPABILITY_NOT_FOUND", `no capability registered for kind: ${kind}`);
      }
      throw new DispatchError("CAPABILITY_AMBIGUOUS", `multiple capabilities registered for kind: ${kind}`);
    }
  }

  private authorize(request: DispatchRequest): DispatchPlan["authorization"] {
    const actor = resolveActor(request.subject);
    if (!actor) {
      throw new DispatchError("AUTH_REQUIRED", `unresolvable actor subject: ${request.subject}`);
    }

    const context: PermissionContext = {
      actor_id: actor.id,
      actor_mode: resolveActorMode(actor),
      role: actor.role,
      action: request.authz.action,
      resource_kind: request.authz.resource_kind,
      resource_id: request.authz.resource_id,
      is_owner: request.authz.is_owner,
      visibility_scope: request.authz.visibility_scope,
    };

    const result = permissionResolverV2.resolve(context);

    if (result.decision === "deny") {
      throw new DispatchError("FORBIDDEN", `authz deny for action ${request.authz.action}`, {
        reason_code: result.explain.reason_code,
      });
    }
    if (result.decision === "needs_approval") {
      throw new DispatchError("APPROVAL_REQUIRED", `action requires approval: ${request.authz.action}`, {
        reason_code: result.explain.reason_code,
      });
    }

    return {
      actor_id: actor.id,
      decision: "allow",
      reason_code: result.explain.reason_code,
    };
  }

  private resolveBinding(kind: CapabilityKind): CapabilityExecutionBinding {
    const binding = this.ports.bindingRegistry.resolveByCapabilityKind(kind);
    if (!binding) {
      throw new DispatchError("NO_EXECUTION_BINDING", `no execution binding for capability kind: ${kind}`);
    }
    return binding;
  }

  private checkAvailability(binding: CapabilityExecutionBinding): DispatchPlan["availability"] {
    if (!binding.runtime_target) {
      return null;
    }
    const status = getTargetStatus(binding.runtime_target) ?? "offline";
    if (status === "offline") {
      throw new DispatchError("TARGET_OFFLINE", `runtime target offline: ${binding.runtime_target}`);
    }
    if (status === "degraded") {
      throw new DispatchError("TARGET_DEGRADED", `runtime target degraded: ${binding.runtime_target}`);
    }
    return { target: binding.runtime_target, status: "online" };
  }

  private async selectProvider(
    request: DispatchRequest,
    binding: CapabilityExecutionBinding,
  ): Promise<DispatchPlanProvider | null> {
    if (!binding.requires_provider) {
      return null;
    }
    if (!request.provider) {
      throw new DispatchError(
        "PROVIDER_SELECTION_FAILED",
        "provider-backed route requires provider requirements in request",
      );
    }
    if (!this.ports.providerSelector) {
      throw new DispatchError(
        "PROVIDER_SELECTION_FAILED",
        "provider-backed route has no provider selector wired",
      );
    }

    const providerRequest: ProviderRouteRequest = {
      run_id: request.run_id,
      trace_id: request.trace_id,
      runtime_mode: request.provider.runtime_mode,
      task_kind: request.provider.task_kind,
      intent: request.intent.intent,
      risk_level: request.intent.risk_level,
      context: request.provider.context,
      constraints: request.provider.constraints,
    };

    const decision = await this.ports.providerSelector.select(providerRequest);

    if (!decision || decision.provider_id === "none") {
      throw new DispatchError(
        "PROVIDER_SELECTION_FAILED",
        decision?.reason ?? "no provider selected by Provider OS",
      );
    }

    return {
      provider_id: decision.provider_id,
      score: decision.score,
      fallback_provider_ids: [...decision.fallback_provider_ids],
    };
  }
}
