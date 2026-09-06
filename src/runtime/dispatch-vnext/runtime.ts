import { CapabilityRegistry } from "../capability-vnext/capability-registry.js";
import type { CapabilityDescriptor } from "../capability-vnext/capability-descriptor.js";
import { classifyIntent } from "../intent/intent-engine.js";
import { ProviderRegistry } from "../provider/provider-registry.js";
import { ProviderRouterV2 } from "../provider/provider-router-v2.js";
import type { ProviderProfile } from "../provider/provider-profile.js";
import { DispatchExecutionCoordinator } from "./dispatch-execution.js";
import { DemoReplyExecutor, ExecutionRouteRegistry } from "./dispatch-executor.js";
import { ExecutionBindingRegistry, type CapabilityExecutionBinding } from "./dispatch-bindings.js";
import { DispatchPlanner } from "./dispatch-planner.js";
import type { DispatchAuthzContext, DispatchProviderRequirements, DispatchRequest } from "./dispatch.types.js";
import type { DispatchResult } from "./dispatch-execution.types.js";

// PD-W2/A5 — First production slice: deterministic offline query reply.
// Exactly ONE capability descriptor, ONE execution binding, ONE provider
// profile (real committed `local:llm` data) and ONE executor, composed onto
// the canonical authorities. No catalogue.

export const DEMO_REPLY_CAPABILITY: Readonly<CapabilityDescriptor> = {
  capability_id: "cap.model.demo_reply",
  kind: "model",
  trust_level: "core",
  title: "Deterministic offline query reply",
  description:
    "Serve a deterministic offline reply through the canonical pipeline: Provider OS selects local:llm, the demo executor returns the real committed demo provider output. No network, no destructive side effects.",
  permissions: {
    filesystem: "none",
    network: "none",
    browser: "none",
    terminal: "none",
    secrets: "none",
  },
};

export const DEMO_REPLY_BINDING: Readonly<CapabilityExecutionBinding> = {
  capability_kind: "model",
  execution_route_kind: "provider_bridge",
  runtime_target: "kilo_mcp",
  requires_provider: true,
};

export const LOCAL_LLM_PROVIDER_PROFILE: Readonly<ProviderProfile> = {
  provider_id: "local:llm",
  kind: "local",
  access_tier: "local_model",
  display_name: "Local LLM",
  allowed_modes: ["public", "creator", "internal"],
  strengths: ["reasoning", "coding", "summarization", "planning"],
  limits: {
    max_context_tokens: 8192,
    supports_files: false,
    supports_images: false,
    supports_web_research: false,
    supports_code_execution: false,
  },
  cost: { tier: "free", metered: false },
  privacy: { level: "local", allow_sensitive: true },
  reliability: { score: 6.0, last_known_status: "healthy" },
  enabled: true,
};

export interface DemoReplyRuntime {
  readonly capabilityRegistry: CapabilityRegistry;
  readonly bindingRegistry: ExecutionBindingRegistry;
  readonly planner: DispatchPlanner;
  readonly routes: ExecutionRouteRegistry;
  readonly coordinator: DispatchExecutionCoordinator;
}

export function createDemoReplyRuntime(): DemoReplyRuntime {
  const capabilityRegistry = new CapabilityRegistry();
  capabilityRegistry.register({ ...DEMO_REPLY_CAPABILITY });

  const bindingRegistry = new ExecutionBindingRegistry();
  bindingRegistry.register({ ...DEMO_REPLY_BINDING });

  const providerRegistry = new ProviderRegistry();
  providerRegistry.register({ ...LOCAL_LLM_PROVIDER_PROFILE });
  const providerSelector = new ProviderRouterV2(providerRegistry);

  const planner = new DispatchPlanner({
    capabilityRegistry,
    bindingRegistry,
    providerSelector,
  });

  const routes = new ExecutionRouteRegistry();
  routes.register(new DemoReplyExecutor());

  const coordinator = new DispatchExecutionCoordinator(routes);

  return { capabilityRegistry, bindingRegistry, planner, routes, coordinator };
}

export interface DemoReplyExecutionRequest {
  readonly subject: string;
  readonly authz: DispatchAuthzContext;
  readonly message: string;
  readonly run_id: string;
  readonly trace_id: string;
}

export async function runDemoReply(request: DemoReplyExecutionRequest): Promise<DispatchResult<unknown>> {
  const runtime = createDemoReplyRuntime();
  const dispatch = buildDemoReplyDispatchRequest(request);
  const plan = await runtime.planner.planDispatch(dispatch);
  return runtime.coordinator.safeExecute(plan, {
    subject: request.subject,
    authz: request.authz,
    payload: { message: request.message },
  });
}

function buildDemoReplyDispatchRequest(request: DemoReplyExecutionRequest): DispatchRequest {
  const intent = classifyIntent({
    input_id: request.run_id,
    user_id: request.subject,
    surface: "api",
    type: "text",
    content: request.message,
    attachments: [],
    metadata: {},
    received_at: new Date().toISOString(),
  });
  const provider: DispatchProviderRequirements = {
    runtime_mode: "public",
    task_kind: "reasoning",
    context: { used_tokens: 0, max_tokens: 4096, has_files: false, has_images: false },
    constraints: { quality: "normal", latency: "normal", cost: "free", privacy: "local_only" },
  };
  return {
    run_id: request.run_id,
    trace_id: request.trace_id,
    intent,
    capability_kind: "model",
    subject: request.subject,
    authz: request.authz,
    provider,
    execution_payload: { message: request.message },
  };
}