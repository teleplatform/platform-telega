import type { ChannelBinding } from "../../runtime-channel-contracts/src/binding.js";
import type { UnifiedTransport } from "../../runtime-channel-contracts/src/inbound.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export function createChannelBinding(input: {
  tele_user_id: string;
  transport: UnifiedTransport;
  transport_user_id?: string;
  transport_chat_id?: string;
  transport_session_ref?: string;
  workspace_id?: string;
  is_primary?: boolean;
}): ChannelBinding {
  return {
    binding_id: `binding_${randomUUID()}`,
    tele_user_id: input.tele_user_id,
    transport: input.transport,
    transport_user_id: input.transport_user_id,
    transport_chat_id: input.transport_chat_id,
    transport_session_ref: input.transport_session_ref,
    workspace_id: input.workspace_id,
    is_primary: input.is_primary ?? true,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

export function resolvePrimaryBinding(bindings: ChannelBinding[]): ChannelBinding | null {
  return bindings.find((b) => b.is_primary) ?? bindings[0] ?? null;
}

export function resolveBindingsByUser(bindings: ChannelBinding[], tele_user_id: string): ChannelBinding[] {
  return bindings.filter((b) => b.tele_user_id === tele_user_id);
}

export function resolveBindingByTransport(bindings: ChannelBinding[], tele_user_id: string, transport: UnifiedTransport): ChannelBinding | null {
  return bindings.find((b) => b.tele_user_id === tele_user_id && b.transport === transport) ?? null;
}
