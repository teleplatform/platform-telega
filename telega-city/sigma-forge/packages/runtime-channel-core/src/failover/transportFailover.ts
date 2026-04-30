import type { ReplayState, TransportFailoverDecision } from "../../runtime-channel-contracts/src/replay.js";
import type { UnifiedTransport } from "../../runtime-channel-contracts/src/inbound.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export const FAILOVER_PRIORITY: UnifiedTransport[] = ["tgm", "web", "miniapp", "telegram", "max"];

export function createReplayState(input: {
  tele_user_id: string;
  session_id: string;
  task_id?: string;
  last_transport?: UnifiedTransport;
  last_event_ref?: string;
  last_message_ref?: string;
  continuity_summary?: string;
  recovery_hint?: string;
}): ReplayState {
  return {
    replay_id: `replay_${randomUUID()}`,
    tele_user_id: input.tele_user_id,
    session_id: input.session_id,
    task_id: input.task_id,
    last_transport: input.last_transport,
    last_event_ref: input.last_event_ref,
    last_message_ref: input.last_message_ref,
    continuity_summary: input.continuity_summary,
    recovery_hint: input.recovery_hint,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

export interface TransportAvailability {
  transport: UnifiedTransport;
  available: boolean;
  reasons: string[];
}

export interface FailoverContext {
  tele_user_id: string;
  current_transport: UnifiedTransport;
  available_transports: TransportAvailability[];
  session_id?: string;
}

export function decideTransportFailover(context: FailoverContext): TransportFailoverDecision {
  const current = context.available_transports.find((t) => t.transport === context.current_transport);
  if (current?.available) {
    return { allowed: true, from_transport: context.current_transport, reasons: ["current_transport_available"], replay_required: false };
  }

  for (const transport of FAILOVER_PRIORITY) {
    const avail = context.available_transports.find((t) => t.transport === transport);
    if (avail?.available) {
      return {
        allowed: true,
        from_transport: context.current_transport,
        to_transport: transport,
        reasons: [`failover_to_${transport}`],
        replay_required: !!context.session_id,
      };
    }
  }

  return {
    allowed: false,
    from_transport: context.current_transport,
    reasons: ["no_available_transport"],
    replay_required: false,
  };
}

export function buildReplaySummary(state: ReplayState, recentEvents: any[]): string {
  const parts = [`Session: ${state.session_id}`];
  if (state.continuity_summary) parts.push(state.continuity_summary);
  if (state.last_transport) parts.push(`Last transport: ${state.last_transport}`);
  if (state.task_id) parts.push(`Task: ${state.task_id}`);
  parts.push(`Events: ${recentEvents.length}`);
  return parts.join(" | ");
}
