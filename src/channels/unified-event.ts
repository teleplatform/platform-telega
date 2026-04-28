export interface UnifiedInboundEvent {
  channel: "alice" | "telegram";
  trace_id: string;
  channel_user_id: string;
  channel_session_id?: string;
  message_id: string;
  text: string;
  locale?: string;
  raw_payload: Record<string, unknown>;
  metadata: {
    chat_id?: string;
    user_first_name?: string;
    is_group?: boolean;
    command?: string;
    [key: string]: unknown;
  };
}

export interface UnifiedOutboundEvent {
  trace_id: string;
  target_channel: "alice" | "telegram";
  response_type: "immediate" | "final" | "handoff";
  display_text?: string;
  speak_text?: string;
  buttons?: Array<{
    text: string;
    url?: string;
    callback_data?: string;
  }>;
  handoff?: {
    to_channel: string;
    reason: string;
  };
  end_session?: boolean;
  audio_output?: {
    asset_id: string;
    file_path?: string;
    filename?: string;
    mime?: string;
    size_bytes?: number;
    provider?: string;
    duration_ms?: number;
    audio_url?: string;
  };
  audio_delivery?: {
    attempted: boolean;
    channel?: string;
    status?: "sent" | "prepared" | "failed" | "skipped";
    error?: string;
    fallback_used?: boolean;
    outbound_message_id?: string;
    outbound_method?: string;
  };
}

export type Channel = "alice" | "telegram";

export interface ChannelLogEvent {
  event: string;
  trace_id: string;
  channel: Channel;
  adapter: string;
  outcome: "success" | "failure" | "ignored";
  reason?: string;
  duration_ms?: number;
  message_id?: string;
  session_key?: string;
}

export function createTraceId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
