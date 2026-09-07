// PD-W3/B3-B — Worker execution dispatch runtime. Composes the canonical
// authorities (capability registry, binding registry, planner, route registry,
// execution coordinator) around the WorkerExecutionAdapter. No Provider OS
// participation (binding requires_provider: false → planner returns provider
// null). No runtime_target is set: Availability does not model individual
// workers — Worker liveness stays Worker-domain truth, so Dispatch does not
// fabricate a target status.
//
// Worker mode remains DORMANT: no WorkerRuntime is instantiated, enableWorkerMode
// is never called, sigma-forge default mode stays 'direct'. This runtime proves
// integration readiness, not production activation. The transport is wired only
// by an explicit injection (tests/integration); otherwise it fails closed.

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
  WorkerExecutionAdapter,
  type WorkerExecutionPort,
} from "./worker-execution-adapter.js";

export const WORKER_RUNTIME_CAPABILITY: Readonly<CapabilityDescriptor> = {
  capability_id: "cap.worker_execution",
  kind: "worker_runtime",
  trust_level: "core",
  title: "Worker execution through the canonical Worker runtime",
  description:
    "Execute worker tasks via the canonical Dispatch pipeline: Dispatch owns the execution lifecycle, identity/capability recheck and safe hand-off; the Worker domain owns the assignment belt (assignNodeToWorker→findBestWorker→WorkerAssignment), reassignment/degradation, federation/HMAC transport and worker evidence. Internal/system only (call_bridge_worker). Worker mode stays dormant — integration-ready, not activated.",
  permissions: {
    filesystem: "none",
    network: "none",
    browser: "none",
    terminal: "none",
    secrets: "none",
  },
};

export const WORKER_RUNTIME_BINDING: Readonly<CapabilityExecutionBinding> = {
  capability_kind: "worker_runtime",
  execution_route_kind: "worker_runtime",
  requires_provider: false,
};

export interface WorkerRuntime {
  readonly capabilityRegistry: CapabilityRegistry;
  readonly bindingRegistry: ExecutionBindingRegistry;
  readonly planner: DispatchPlanner;
  readonly routes: ExecutionRouteRegistry;
  readonly coordinator: DispatchExecutionCoordinator;
}

export function createWorkerRuntime(opts?: {
  transport?: WorkerExecutionPort;
}): WorkerRuntime {
  const capabilityRegistry = new CapabilityRegistry();
  capabilityRegistry.register({ ...WORKER_RUNTIME_CAPABILITY });

  const bindingRegistry = new ExecutionBindingRegistry();
  bindingRegistry.register({ ...WORKER_RUNTIME_BINDING });

  const planner = new DispatchPlanner({ capabilityRegistry, bindingRegistry });

  const routes = new ExecutionRouteRegistry();
  routes.register(new WorkerExecutionAdapter(opts?.transport ?? null));

  const coordinator = new DispatchExecutionCoordinator(routes);

  return { capabilityRegistry, bindingRegistry, planner, routes, coordinator };
}

export interface WorkerExecutionRequest {
  readonly subject: string;
  readonly authz: DispatchAuthzContext;
  readonly payload: Record<string, unknown>;
  readonly run_id: string;
  readonly trace_id: string;
}

export function buildWorkerDispatchRequest(
  request: WorkerExecutionRequest,
): DispatchRequest {
  const prompt =
    typeof request.payload?.label === "string"
      ? request.payload.label
      : "worker execution task";
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
    capability_kind: "worker_runtime",
    subject: request.subject,
    authz: request.authz,
    execution_payload: request.payload,
  };
}

export async function runWorkerExecution(
  request: WorkerExecutionRequest,
  opts?: { transport?: WorkerExecutionPort },
): Promise<DispatchResult<unknown>> {
  const runtime = createWorkerRuntime(opts);
  const dispatch = buildWorkerDispatchRequest(request);
  const plan = await runtime.planner.planDispatch(dispatch);
  return runtime.coordinator.safeExecute(plan, {
    subject: request.subject,
    authz: request.authz,
    payload: request.payload,
  });
}
