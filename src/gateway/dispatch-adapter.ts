// PD-W3/B2 — Authenticated gateway → Dispatch vNext adapter.
// PD-W3/B4-A — identity construction now flows through the canonical
// trusted-context boundary (src/core/trusted-context).
//
// Trust boundary: the ONLY identity this module accepts is the server-verified
// API key record produced by gatewayAuthMiddleware (validateApiKey). The
// canonical actor is derived from it (api:<id>) via the canonical
// TrustedExecutionContext factory, never from request payload or meta.
// Raw tokens never enter the context.
//
// The safe demo execution slice (model "local-demo") is routed through the
// canonical Dispatch pipeline (Plan → Authorize → Availability → Execute →
// real executor output) and mapped back to the existing OpenAI-compatible
// response contract. No dual execution: a demo request is served exclusively
// by Dispatch; the legacy routeChat seam stays untouched for everything else.

import type { TeleGptApiKey } from "../api-keys/store.js";
import { resolveActor } from "../core/authz/actor.js";
import {
  createTrustedExecutionContext,
  type TrustedExecutionContext,
} from "../core/trusted-context/index.js";
import type { ChatResponse } from "../types/chat.js";
import { runDemoReply, runProviderChat } from "../runtime/dispatch-vnext/runtime.js";
import type { DispatchAuthzContext } from "../runtime/dispatch-vnext/dispatch.types.js";
import type { DispatchResult } from "../runtime/dispatch-vnext/dispatch-execution.types.js";

export type { TrustedExecutionContext } from "../core/trusted-context/index.js";

export const DEMO_MODEL = "local-demo";
export const PROVIDER_CHAT_MODEL = "local:local-chat";

export function isDemoModel(model: string | null | undefined): boolean {
  return typeof model === "string" && model.trim() === DEMO_MODEL;
}

// PD-W3/B4-B — Exact model, never a blanket local:* prefix. Only this proven
// production model name routes to the authenticated Dispatch provider chat
// slice; any other local:* alias stays on the legacy routeChat seam.
export function isProviderChatModel(model: string | null | undefined): boolean {
  return typeof model === "string" && model.trim() === PROVIDER_CHAT_MODEL;
}

// Canonical trusted execution context. Constructed ONLY from the verified API
// key; `actor` is the canonical resolveActor interpretation (kind "api",
// role "public"), never a self-asserted identity. Raw tokens never enter the
// context — only the derived canonical subject `api:<id>`.
export function resolveGatewayActor(apiKey: TeleGptApiKey): TrustedExecutionContext {
  const subject = `api:${apiKey.id}`;
  return createTrustedExecutionContext({
    subject,
    actor: resolveActor(subject),
    source: "gateway.authentication.verified_api_key",
  });
}

export class GatewayDispatchError extends Error {
  readonly statusCode: number;
  readonly errorType: string;

  constructor(cause: { message: string; statusCode: number; errorType: string }) {
    super(cause.message);
    this.name = "GatewayDispatchError";
    this.statusCode = cause.statusCode;
    this.errorType = cause.errorType;
  }
}

export interface GatewayDemoDispatchInput {
  apiKey: TeleGptApiKey;
  message: string;
  run_id: string;
  trace_id: string;
}

export async function dispatchDemoReply(input: GatewayDemoDispatchInput): Promise<ChatResponse> {
  const trusted = resolveGatewayActor(input.apiKey);
  if (!trusted.actor) {
    throw new GatewayDispatchError({
      message: `Unable to resolve canonical actor for ${trusted.subject}`,
      statusCode: 500,
      errorType: "internal_server_error",
    });
  }

  const authz: DispatchAuthzContext = {
    action: "agent.run",
    resource_kind: "session",
    resource_id: input.run_id,
    is_owner: false,
    visibility_scope: "public",
  };

  const result = await runDemoReply({
    subject: trusted.subject,
    authz,
    message: input.message,
    run_id: input.run_id,
    trace_id: input.trace_id,
  });

  return mapDispatchResult(result);
}

export interface GatewayProviderChatDispatchInput {
  apiKey: TeleGptApiKey;
  message: string;
  model: string;
  system?: string;
  run_id: string;
  trace_id: string;
}

// PD-W3/B4-B — Authenticated local chat slice through the canonical Dispatch
// pipeline (same trust boundary as the demo slice: canonical api:<id> identity
// only, Provider OS selection, single canonical evidence lifecycle). The real
// localChat transport facts (provider/model/usage) are preserved in the
// returned ChatResponse; no routeChat is involved for this slice.
export async function dispatchProviderChat(input: GatewayProviderChatDispatchInput): Promise<ChatResponse> {
  const trusted = resolveGatewayActor(input.apiKey);
  if (!trusted.actor) {
    throw new GatewayDispatchError({
      message: `Unable to resolve canonical actor for ${trusted.subject}`,
      statusCode: 500,
      errorType: "internal_server_error",
    });
  }

  const authz: DispatchAuthzContext = {
    action: "agent.run",
    resource_kind: "session",
    resource_id: input.run_id,
    is_owner: false,
    visibility_scope: "public",
  };

  const result = await runProviderChat({
    subject: trusted.subject,
    authz,
    message: input.message,
    model: input.model,
    system: input.system,
    run_id: input.run_id,
    trace_id: input.trace_id,
  });

  if (result.execution_state === "completed" && result.outcome?.status === "completed") {
    const transport = (result.outcome.output as ChatResponse | undefined) ?? {
      id: input.model,
      model: input.model,
      output: "",
    };
    const transportUsage = transport.meta?.usage;
    const usage = transportUsage
      ? {
          inputTokens: transportUsage.tokens_in,
          outputTokens: transportUsage.tokens_out,
        }
      : undefined;
    return {
      id: transport.id || input.model,
      model: input.model,
      output: transport.output ?? "",
      usage,
      meta: {
        provider: "local",
        model: transport.model ?? input.model,
        usage,
      },
    };
  }

  throw dispatchFailureError(result);
}

function mapDispatchResult(result: DispatchResult<unknown>): ChatResponse {
  if (result.execution_state === "completed" && result.outcome?.status === "completed") {
    return {
      id: DEMO_MODEL,
      model: DEMO_MODEL,
      output: (result.outcome.output as string) ?? "",
    };
  }
  throw dispatchFailureError(result);
}

function dispatchFailureError(result: DispatchResult<unknown>): never {
  const state = result.execution_state;
  switch (state) {
    case "denied":
    case "approval_required":
      throw new GatewayDispatchError({
        message: `Dispatch denied for run ${result.dispatch_id}: ${result.reason_code ?? "FORBIDDEN"}`,
        statusCode: 403,
        errorType: "permission_denied",
      });
    case "unavailable":
      throw new GatewayDispatchError({
        message: `No available dispatch route for run ${result.dispatch_id}: ${result.reason_code ?? "unavailable"}`,
        statusCode: 503,
        errorType: "internal_server_error",
      });
    case "failed":
      throw new GatewayDispatchError({
        message: result.outcome?.error?.message ?? `Dispatch execution failed for run ${result.dispatch_id}`,
        statusCode: 500,
        errorType: "internal_server_error",
      });
    default:
      throw new GatewayDispatchError({
        message: `Dispatch returned unknown state "${state}" for run ${result.dispatch_id}`,
        statusCode: 500,
        errorType: "internal_server_error",
      });
  }
}