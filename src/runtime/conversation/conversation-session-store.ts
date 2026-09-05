import type { ConversationSession, ConversationSurface, ConversationRuntimeMode, SessionProviderId } from "./conversation-session.types.js";

export class ConversationSessionStore {
  private session: ConversationSession | null = null;
  onStateChange?: (eventType: string, payload: Record<string, unknown>) => void;

  create(overrides?: Partial<ConversationSession>): ConversationSession {
    const now = new Date().toISOString();
    this.session = {
      session_id: overrides?.session_id ?? `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      owner_id: overrides?.owner_id ?? "default",
      surface: overrides?.surface ?? "telegram",
      runtime_mode: overrides?.runtime_mode ?? "creator",
      active: {
        provider_id: overrides?.active?.provider_id,
        provider_access_tier: overrides?.active?.provider_access_tier,
        chat_thread_id: overrides?.active?.chat_thread_id,
        workspace_id: overrides?.active?.workspace_id,
        voice_persona_id: overrides?.active?.voice_persona_id,
      },
      preferences: {
        voice_input_enabled: overrides?.preferences?.voice_input_enabled ?? false,
        voice_reply_enabled: overrides?.preferences?.voice_reply_enabled ?? false,
        smart_formatting_enabled: overrides?.preferences?.smart_formatting_enabled ?? true,
        relay_enabled: overrides?.preferences?.relay_enabled ?? true,
        image_generation_enabled: overrides?.preferences?.image_generation_enabled ?? true,
      },
      last: {
        run_id: overrides?.last?.run_id,
        trace_id: overrides?.last?.trace_id,
        relay_id: overrides?.last?.relay_id,
        artifact_id: overrides?.last?.artifact_id,
        message_id: overrides?.last?.message_id,
      },
      timestamps: {
        created_at: overrides?.timestamps?.created_at ?? now,
        updated_at: now,
        last_activity_at: now,
      },
    };
    this.onStateChange?.("conversation.updated", { action: "create", session_id: this.session.session_id });
    return this.session;
  }

  get(): ConversationSession | null {
    return this.session;
  }

  require(): ConversationSession {
    if (!this.session) {
      return this.create();
    }
    return this.session;
  }

  update(updates: Partial<ConversationSession>): ConversationSession {
    const s = this.require();
    const now = new Date().toISOString();

    if (updates.active) {
      s.active = { ...s.active, ...updates.active } as ConversationSession["active"];
    }
    if (updates.preferences) {
      s.preferences = { ...s.preferences, ...updates.preferences } as ConversationSession["preferences"];
    }
    if (updates.last) {
      s.last = { ...s.last, ...updates.last } as ConversationSession["last"];
    }
    if (updates.surface) s.surface = updates.surface;
    if (updates.runtime_mode) s.runtime_mode = updates.runtime_mode;

    s.timestamps.updated_at = now;
    s.timestamps.last_activity_at = now;
    this.onStateChange?.("conversation.updated", { action: "update", session_id: s.session_id });
    return s;
  }

  touch(): ConversationSession {
    const s = this.require();
    const now = new Date().toISOString();
    s.timestamps.last_activity_at = now;
    s.timestamps.updated_at = now;
    this.onStateChange?.("conversation.updated", { action: "touch", session_id: s.session_id });
    return s;
  }

  reset(): ConversationSession {
    const now = new Date().toISOString();
    this.session = {
      session_id: this.session?.session_id ?? `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      owner_id: this.session?.owner_id ?? "default",
      surface: this.session?.surface ?? "telegram",
      runtime_mode: this.session?.runtime_mode ?? "creator",
      active: {},
      preferences: {
        voice_input_enabled: false,
        voice_reply_enabled: false,
        smart_formatting_enabled: true,
        relay_enabled: true,
        image_generation_enabled: true,
      },
      last: {},
      timestamps: {
        created_at: now,
        updated_at: now,
        last_activity_at: now,
      },
    };
    this.onStateChange?.("conversation.updated", { action: "reset", session_id: this.session.session_id });
    return this.session;
  }

  setActiveProvider(provider_id: SessionProviderId): void {
    this.update({ active: { provider_id } } as any);
    this.onStateChange?.("provider.changed", { provider_id, session_id: this.session?.session_id });
  }

  setActiveThread(chat_thread_id: string): void {
    this.update({ active: { chat_thread_id } } as any);
    this.onStateChange?.("workspace.thread.changed", { chat_thread_id, session_id: this.session?.session_id });
  }

  setVoicePersona(voice_persona_id: string): void {
    this.update({ active: { voice_persona_id } } as any);
    this.onStateChange?.("voice.mode.changed", { voice_persona_id, session_id: this.session?.session_id });
  }

  setVoiceInputEnabled(enabled: boolean): void {
    this.update({ preferences: { voice_input_enabled: enabled } } as any);
    this.onStateChange?.("voice.mode.changed", { voice_input_enabled: enabled, session_id: this.session?.session_id });
  }

  setVoiceReplyEnabled(enabled: boolean): void {
    this.update({ preferences: { voice_reply_enabled: enabled } } as any);
    this.onStateChange?.("voice.mode.changed", { voice_reply_enabled: enabled, session_id: this.session?.session_id });
  }

  setLastRun(run_id: string, trace_id: string): void {
    this.update({ last: { run_id, trace_id } } as any);
    this.onStateChange?.("run.started", { run_id, trace_id, session_id: this.session?.session_id });
  }

  setLastRelay(relay_id: string): void {
    this.update({ last: { relay_id } } as any);
    this.onStateChange?.("relay.changed", { relay_id, session_id: this.session?.session_id });
  }

  setLastArtifact(artifact_id: string): void {
    this.update({ last: { artifact_id } } as any);
    this.onStateChange?.("artifact.created", { artifact_id, session_id: this.session?.session_id });
  }

  setLastMessage(message_id: string): void {
    this.update({ last: { message_id } } as any);
    this.onStateChange?.("message.sent", { message_id, session_id: this.session?.session_id });
  }

  setLastWaitingStatusId(waiting_status_id: string): void {
    this.update({ last: { waiting_status_id } } as any);
    this.onStateChange?.("waiting.status.shown", { waiting_status_id, session_id: this.session?.session_id });
  }

  setLastRealtimeStreamId(realtime_stream_id: string): void {
    this.update({ last: { realtime_stream_id } } as any);
    this.onStateChange?.("stream.started", { realtime_stream_id, session_id: this.session?.session_id });
  }
}
