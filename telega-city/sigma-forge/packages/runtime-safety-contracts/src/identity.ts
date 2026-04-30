export interface RuntimeIdentity {
  tele_user_id: string;
  workspace_id?: string;
  store_id?: string;
  agent_id?: string;
  session_id?: string;
  task_id?: string;
  channel_identity?: {
    transport: string;
    transport_user_id?: string;
    transport_chat_id?: string;
    transport_session_ref?: string;
  };
}
