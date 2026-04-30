import type { UnifiedTransport, UnifiedInboundEvent } from "../../runtime-channel-contracts/src/inbound.js";
import type { ChannelBinding } from "../../runtime-channel-contracts/src/binding.js";
import type { ReplayState, TransportFailoverDecision } from "../../runtime-channel-contracts/src/replay.js";
import type { ChannelAdapter, AdapterRegistry } from "../adapters/adapterRegistry.js";
import { createChannelBinding, resolvePrimaryBinding, resolveBindingsByUser } from "../binding/channelBinding.js";
import { createReplayState, decideTransportFailover, buildReplaySummary, FAILOVER_PRIORITY } from "../failover/transportFailover.js";

export interface NormalizeInboundInput {
  transport: UnifiedTransport;
  raw: unknown;
}

export interface BindChannelInput {
  tele_user_id: string;
  transport: UnifiedTransport;
  transport_user_id?: string;
  transport_chat_id?: string;
  transport_session_ref?: string;
  workspace_id?: string;
  is_primary?: boolean;
}

export interface BindChannelResult {
  binding: ChannelBinding;
  is_new: boolean;
}

export interface ReplaySessionInput {
  tele_user_id: string;
  session_id: string;
  task_id?: string;
  last_transport?: UnifiedTransport;
  continuity_summary?: string;
  recovery_hint?: string;
}

export interface ReplaySessionResult {
  restored: boolean;
  via_transport?: UnifiedTransport;
  session_id: string;
  summary: string;
}

export interface ResolveFailoverInput {
  tele_user_id: string;
  current_transport: UnifiedTransport;
  available_transports: Array<{ transport: UnifiedTransport; available: boolean; reasons: string[] }>;
  session_id?: string;
}

export interface ResolveFailoverResult {
  decision: TransportFailoverDecision;
  via_transport?: UnifiedTransport;
  replay_required: boolean;
}

// ─── API Facades ────────────────────────────────────────────────────────────

export function normalizeInboundEvent(input: NormalizeInboundInput, registry: AdapterRegistry): UnifiedInboundEvent {
  const adapter = registry.getAdapter(input.transport);
  if (!adapter) {
    throw new Error(`No adapter registered for transport: ${input.transport}`);
  }
  return adapter.normalizeInbound(input.raw);
}

export function bindChannelIdentity(input: BindChannelInput, existingBindings: ChannelBinding[]): BindChannelResult {
  const existing = resolveBindingsByUser(existingBindings, input.tele_user_id);
  const existingForTransport = existing.find((b) => b.transport === input.transport);

  if (existingForTransport) {
    return { binding: existingForTransport, is_new: false };
  }

  const binding = createChannelBinding(input);
  return { binding, is_new: true };
}

export function replaySession(input: ReplaySessionInput): ReplaySessionResult {
  const state = createReplayState({
    tele_user_id: input.tele_user_id,
    session_id: input.session_id,
    task_id: input.task_id,
    last_transport: input.last_transport,
    continuity_summary: input.continuity_summary,
    recovery_hint: input.recovery_hint,
  });

  const summary = buildReplaySummary(state, []);

  return {
    restored: true,
    via_transport: input.last_transport,
    session_id: input.session_id,
    summary,
  };
}

export function resolveFailover(input: ResolveFailoverInput): ResolveFailoverResult {
  const decision = decideTransportFailover({
    tele_user_id: input.tele_user_id,
    current_transport: input.current_transport,
    available_transports: input.available_transports,
    session_id: input.session_id,
  });

  return {
    decision,
    via_transport: decision.to_transport,
    replay_required: decision.replay_required,
  };
}
