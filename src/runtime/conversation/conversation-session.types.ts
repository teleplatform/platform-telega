export type ConversationSurface =
  | "telegram"
  | "web"
  | "desktop"
  | "mobile"
  | "mini_app"
  | "alice_bridge";

export type ConversationRuntimeMode =
  | "public"
  | "creator"
  | "internal";

export type SessionProviderId =
  | "openai:web"
  | "qwen:web"
  | "deepseek:web"
  | "local:llm"
  | "openai:api"
  | "qwen:api"
  | "deepseek:api";

export type ProviderAccessTier = "local_model" | "api_model" | "creator_web";

export interface ConversationSession {
  session_id: string;
  owner_id: string;

  surface: ConversationSurface;
  runtime_mode: ConversationRuntimeMode;

  active: {
    provider_id?: SessionProviderId;
    provider_access_tier?: ProviderAccessTier;
    chat_thread_id?: string;
    workspace_id?: string;
    voice_persona_id?: string;
  };

  preferences: {
    voice_input_enabled: boolean;
    voice_reply_enabled: boolean;
    smart_formatting_enabled: boolean;
    relay_enabled: boolean;
    image_generation_enabled: boolean;
  };

  last: {
    run_id?: string;
    trace_id?: string;
    relay_id?: string;
    artifact_id?: string;
    message_id?: string;
    waiting_status_id?: string;
    realtime_stream_id?: string;
  };

  timestamps: {
    created_at: string;
    updated_at: string;
    last_activity_at: string;
  };
}
