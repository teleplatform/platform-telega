import type { UnifiedTransport } from "./inbound.js";

export interface ChannelBinding {
  binding_id: string;
  tele_user_id: string;
  transport: UnifiedTransport;
  transport_user_id?: string;
  transport_chat_id?: string;
  transport_session_ref?: string;
  workspace_id?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}
