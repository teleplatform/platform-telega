import type { RuntimeIdentity } from "../../runtime-safety-contracts/src/identity.js";
import type { ScopeBinding } from "../../runtime-safety-contracts/src/scope.js";
import { randomUUID } from "crypto";

export function buildRuntimeIdentity(input: {
  tele_user_id: string;
  workspace_id?: string;
  store_id?: string;
  agent_id?: string;
  session_id?: string;
  task_id?: string;
  channel_transport?: string;
  channel_user_id?: string;
  channel_chat_id?: string;
  channel_session_ref?: string;
}): RuntimeIdentity {
  return {
    tele_user_id: input.tele_user_id,
    workspace_id: input.workspace_id,
    store_id: input.store_id,
    agent_id: input.agent_id,
    session_id: input.session_id,
    task_id: input.task_id,
    channel_identity: input.channel_transport ? {
      transport: input.channel_transport,
      transport_user_id: input.channel_user_id,
      transport_chat_id: input.channel_chat_id,
      transport_session_ref: input.channel_session_ref,
    } : undefined,
  };
}

export function createScopeBinding(identity: RuntimeIdentity): ScopeBinding {
  return {
    scope_id: `scope_${randomUUID()}`,
    tele_user_id: identity.tele_user_id,
    workspace_id: identity.workspace_id,
    store_id: identity.store_id,
    session_id: identity.session_id,
    task_id: identity.task_id,
    bound_at: new Date().toISOString(),
  };
}

export function resolveScopeKey(identity: RuntimeIdentity): string {
  const parts = [identity.tele_user_id];
  if (identity.workspace_id) parts.push(identity.workspace_id);
  if (identity.store_id) parts.push(identity.store_id);
  if (identity.session_id) parts.push(identity.session_id);
  return parts.join(":");
}

export function normalizeChannelIdentity(raw: {
  transport: string;
  transport_user_id?: string;
  transport_chat_id?: string;
  transport_session_ref?: string;
  tele_user_id: string;
}): RuntimeIdentity {
  return {
    tele_user_id: raw.tele_user_id,
    channel_identity: {
      transport: raw.transport,
      transport_user_id: raw.transport_user_id,
      transport_chat_id: raw.transport_chat_id,
      transport_session_ref: raw.transport_session_ref,
    },
  };
}

export interface IdentityResolverResult {
  identity: RuntimeIdentity;
  scope_binding: ScopeBinding;
}

export function resolveRuntimeIdentity(input: Parameters<typeof buildRuntimeIdentity>[0]): IdentityResolverResult {
  const identity = buildRuntimeIdentity(input);
  const scope_binding = createScopeBinding(identity);
  return { identity, scope_binding };
}
