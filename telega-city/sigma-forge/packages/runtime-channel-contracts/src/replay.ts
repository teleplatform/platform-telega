import type { UnifiedTransport } from "./inbound.js";

export interface ReplayState {
  replay_id: string;
  tele_user_id: string;
  session_id: string;
  task_id?: string;
  last_transport?: UnifiedTransport;
  last_event_ref?: string;
  last_message_ref?: string;
  continuity_summary?: string;
  recovery_hint?: string;
  created_at: string;
  updated_at: string;
}

export interface TransportFailoverDecision {
  allowed: boolean;
  from_transport: UnifiedTransport;
  to_transport?: UnifiedTransport;
  reasons: string[];
  replay_required: boolean;
}
