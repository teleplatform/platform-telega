import { ConversationSessionStore } from "./conversation-session-store.js";
import { ConversationStateResolver } from "./conversation-state-resolver.js";

export interface ConversationContextAttachment {
  session_id: string;
  surface: string;
  active_provider: string | undefined;
  active_thread: string | undefined;
  voice_persona: string | undefined;
  preferences: Record<string, boolean>;
  last_run: string | undefined;
  last_artifact: string | undefined;
}

export class ConversationContextBridge {
  private store: ConversationSessionStore;
  private resolver: ConversationStateResolver;

  constructor(store?: ConversationSessionStore, resolver?: ConversationStateResolver) {
    this.store = store ?? new ConversationSessionStore();
    this.resolver = resolver ?? new ConversationStateResolver(this.store);
  }

  attach(): ConversationContextAttachment {
    const s = this.store.require();
    return {
      session_id: s.session_id,
      surface: s.surface,
      active_provider: s.active.provider_id,
      active_thread: s.active.chat_thread_id,
      voice_persona: s.active.voice_persona_id,
      preferences: {
        voice_input_enabled: s.preferences.voice_input_enabled,
        voice_reply_enabled: s.preferences.voice_reply_enabled,
        smart_formatting_enabled: s.preferences.smart_formatting_enabled,
        relay_enabled: s.preferences.relay_enabled,
        image_generation_enabled: s.preferences.image_generation_enabled,
      },
      last_run: s.last.run_id,
      last_artifact: s.last.artifact_id,
    };
  }
}
