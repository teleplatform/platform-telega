import { ConversationSessionStore } from "./conversation-session-store.js";
import type { SessionProviderId } from "./conversation-session.types.js";

export class ConversationStateResolver {
  private store: ConversationSessionStore;

  constructor(store?: ConversationSessionStore) {
    this.store = store ?? new ConversationSessionStore();
  }

  resolveProvider(): SessionProviderId {
    const s = this.store.require();
    return s.active.provider_id ?? "openai:web";
  }

  resolveThread(): string | undefined {
    const s = this.store.require();
    return s.active.chat_thread_id;
  }

  resolveVoicePersona(): string {
    const s = this.store.require();
    return s.active.voice_persona_id ?? "arisha";
  }

  isVoiceInputEnabled(): boolean {
    const s = this.store.require();
    return s.preferences.voice_input_enabled;
  }

  isVoiceReplyEnabled(): boolean {
    const s = this.store.require();
    return s.preferences.voice_reply_enabled;
  }

  isSmartFormattingEnabled(): boolean {
    const s = this.store.require();
    return s.preferences.smart_formatting_enabled;
  }

  isRelayEnabled(): boolean {
    const s = this.store.require();
    return s.preferences.relay_enabled;
  }

  isImageGenerationEnabled(): boolean {
    const s = this.store.require();
    return s.preferences.image_generation_enabled;
  }

  resolveState(): Record<string, unknown> {
    const s = this.store.require();
    return {
      session_id: s.session_id,
      surface: s.surface,
      active_provider: s.active.provider_id,
      active_thread: s.active.chat_thread_id,
      voice_persona: s.active.voice_persona_id,
      voice_input: s.preferences.voice_input_enabled,
      voice_reply: s.preferences.voice_reply_enabled,
      smart_formatting: s.preferences.smart_formatting_enabled,
      relay: s.preferences.relay_enabled,
      image_generation: s.preferences.image_generation_enabled,
      last_run: s.last.run_id,
      last_trace: s.last.trace_id,
      last_artifact: s.last.artifact_id,
    };
  }
}
