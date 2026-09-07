import { CapabilityRegistry } from "../capability-vnext/capability-registry.js";
import type { CapabilityDescriptor } from "../capability-vnext/capability-descriptor.js";
import { classifyIntent } from "../intent/intent-engine.js";
import { ProviderRegistry } from "../provider/provider-registry.js";
import { ProviderRouterV2 } from "../provider/provider-router-v2.js";
import type { ProviderProfile } from "../provider/provider-profile.js";
import { DispatchExecutionCoordinator } from "./dispatch-execution.js";
import { DemoReplyExecutor, ExecutionRouteRegistry } from "./dispatch-executor.js";
import { LocalChatExecutor } from "./local-chat-executor.js";
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

// PD-W3/B4-B — Authenticated local chat slice. Same canonical authorities as
// the demo slice, but a distinct capability kind / route kind that maps to the
// real localChat transport leaf (localhost OpenAI-compatible endpoint with the
// canonical offline fallback). Provider OS owns selection (local:llm); the
// executor owns transient transport only.
export const PROVIDER_CHAT_CAPABILITY: Readonly<CapabilityDescriptor> = {
  capability_id: "cap.provider_chat",
  kind: "provider_chat",
  trust_level: "core",
  title: "Authenticated local chat",
  description:
    "Serve an authenticated local chat completion through the canonical Dispatch pipeline: Provider OS selects local:llm, the local chat executor invokes the canonical localChat transport (localhost endpoint or deterministic offline fallback).",
  permissions: {
    filesystem: "none",
    network: "allowlisted",
    browser: "none",
    terminal: "none",
    secrets: "none",
  },
};

export const PROVIDER_CHAT_BINDING: Readonly<CapabilityExecutionBinding> = {
  capability_kind: "provider_chat",
  execution_route_kind: "provider_http",
  runtime_target: undefined,
  requires_provider: true,
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

export interface ProviderChatRuntime {
  readonly capabilityRegistry: CapabilityRegistry;
  readonly bindingRegistry: ExecutionBindingRegistry;
  readonly planner: DispatchPlanner;
  readonly routes: ExecutionRouteRegistry;
  readonly coordinator: DispatchExecutionCoordinator;
}

export function createProviderChatRuntime(): ProviderChatRuntime {
  const capabilityRegistry = new CapabilityRegistry();
  capabilityRegistry.register({ ...PROVIDER_CHAT_CAPABILITY });

  const bindingRegistry = new ExecutionBindingRegistry();
  bindingRegistry.register({ ...PROVIDER_CHAT_BINDING });

  const providerRegistry = new ProviderRegistry();
  providerRegistry.register({ ...LOCAL_LLM_PROVIDER_PROFILE });
  const providerSelector = new ProviderRouterV2(providerRegistry);

  const planner = new DispatchPlanner({
    capabilityRegistry,
    bindingRegistry,
    providerSelector,
  });

  const routes = new ExecutionRouteRegistry();
  routes.register(new LocalChatExecutor());

  const coordinator = new DispatchExecutionCoordinator(routes);

  return { capabilityRegistry, bindingRegistry, planner, routes, coordinator };
}

export interface ProviderChatExecutionRequest {
  readonly subject: string;
  readonly authz: DispatchAuthzContext;
  readonly message: string;
  readonly model?: string;
  readonly system?: string;
  readonly run_id: string;
  readonly trace_id: string;
}

export async function runProviderChat(request: ProviderChatExecutionRequest): Promise<DispatchResult<unknown>> {
  const runtime = createProviderChatRuntime();
  const dispatch = buildProviderChatDispatchRequest(request);
  const plan = await runtime.planner.planDispatch(dispatch);
  return runtime.coordinator.safeExecute(plan, {
    subject: request.subject,
    authz: request.authz,
    payload: { message: request.message, model: request.model, system: request.system },
  });
}

function buildProviderChatDispatchRequest(request: ProviderChatExecutionRequest): DispatchRequest {
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
    capability_kind: "provider_chat",
    subject: request.subject,
    authz: request.authz,
    provider,
    execution_payload: { message: request.message, model: request.model, system: request.system },
  };
}