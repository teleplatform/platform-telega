// PD-W3/B3-A — Forge execution dispatch runtime. Composes the canonical
// authorities (capability registry, binding registry, planner, route registry,
// execution coordinator) around the ForgeExecutionAdapter. No Provider OS
// participation (binding requires_provider: false → planner returns provider
// null). sigma_forge stays unregistered (deferred/fail-closed); runDemoReply
// and the provider_bridge route are untouched.

import type { CapabilityDescriptor } from "../capability-vnext/capability-descriptor.js";
import { CapabilityRegistry } from "../capability-vnext/capability-registry.js";
import { classifyIntent } from "../intent/intent-engine.js";
import {
  ExecutionBindingRegistry,
  type CapabilityExecutionBinding,
} from "./dispatch-bindings.js";
import type { DispatchResult } from "./dispatch-execution.types.js";
import { DispatchExecutionCoordinator } from "./dispatch-execution.js";
import { ExecutionRouteRegistry } from "./dispatch-executor.js";
import { DispatchPlanner } from "./dispatch-planner.js";
import type {
  DispatchAuthzContext,
  DispatchRequest,
} from "./dispatch.types.js";
import {
  ForgeExecutionAdapter,
  type ForgeExecutionPort,
} from "./forge-execution-adapter.js";

export const FORGE_BRIDGE_CAPABILITY: Readonly<CapabilityDescriptor> = {
  capability_id: "cap.forge_bridge",
  kind: "forge_bridge",
  trust_level: "trusted",
  title: "Forge build/repo execution through the domain Forge bridge",
  description:
    "Execute build/repo tasks via the canonical Dispatch pipeline: Dispatch owns the execution lifecycle, identity and availability recheck; the Forge domain owns scheduler/DAG/readiness and target selection (kilo_mcp when proven online; forge_http only when proven; sigma_forge remains deferred/fail-closed). Domain ForgeResult evidence is preserved.",
  permissions: {
    filesystem: "read",
    network: "allowlisted",
    browser: "none",
    terminal: "none",
    secrets: "none",
  },
};

export const FORGE_BRIDGE_BINDING: Readonly<CapabilityExecutionBinding> = {
  capability_kind: "forge_bridge",
  execution_route_kind: "forge_bridge",
  runtime_target: "kilo_mcp",
  requires_provider: false,
};

export interface ForgeRuntime {
  readonly capabilityRegistry: CapabilityRegistry;
  readonly bindingRegistry: ExecutionBindingRegistry;
  readonly planner: DispatchPlanner;
  readonly routes: ExecutionRouteRegistry;
  readonly coordinator: DispatchExecutionCoordinator;
}

export function createForgeRuntime(opts?: { forge?: ForgeExecutionPort }): ForgeRuntime {
  const capabilityRegistry = new CapabilityRegistry();
  capabilityRegistry.register({ ...FORGE_BRIDGE_CAPABILITY });

  const bindingRegistry = new ExecutionBindingRegistry();
  bindingRegistry.register({ ...FORGE_BRIDGE_BINDING });

  const planner = new DispatchPlanner({ capabilityRegistry, bindingRegistry });

  const routes = new ExecutionRouteRegistry();
  routes.register(new ForgeExecutionAdapter(opts?.forge));

  const coordinator = new DispatchExecutionCoordinator(routes);

  return { capabilityRegistry, bindingRegistry, planner, routes, coordinator };
}

export interface ForgeBuildExecutionRequest {
  readonly subject: string;
  readonly authz: DispatchAuthzContext;
  readonly payload: Record<string, unknown>;
  readonly run_id: string;
  readonly trace_id: string;
}

export function buildForgeDispatchRequest(
  request: ForgeBuildExecutionRequest,
): DispatchRequest {
  const prompt = (request.payload?.prompt as string) ?? "Forge build task";
  const intent = classifyIntent({
    input_id: request.run_id,
    user_id: request.subject,
    surface: "api",
    type: "text",
    content: prompt,
    attachments: [],
    metadata: {},
    received_at: new Date().toISOString(),
  });
  return {
    run_id: request.run_id,
    trace_id: request.trace_id,
    intent,
    capability_kind: "forge_bridge",
    subject: request.subject,
    authz: request.authz,
    execution_payload: request.payload,
  };
}

export async function runForgeBuild(
  request: ForgeBuildExecutionRequest,
): Promise<DispatchResult<unknown>> {
  const runtime = createForgeRuntime();
  const dispatch = buildForgeDispatchRequest(request);
  const plan = await runtime.planner.planDispatch(dispatch);
  return runtime.coordinator.safeExecute(plan, {
    subject: request.subject,
    authz: request.authz,
    payload: request.payload,
  });
}