import { ConversationSessionStore } from "./conversation-session-store.js";

export class ConversationRenderer {
  private store: ConversationSessionStore;

  constructor(store?: ConversationSessionStore) {
    this.store = store ?? new ConversationSessionStore();
  }

  render(): string {
    const s = this.store.get();
    if (!s) {
      return "No active conversation session. Use `/session` to create one.";
    }

    const lines = [
      `## Conversation Session`,
      ``,
      `**Session:** \`${s.session_id}\``,
      `**Surface:** ${s.surface}`,
      `**Mode:** ${s.runtime_mode}`,
      ``,
      `### Active`,
      `**Provider:** ${s.active.provider_id ?? "none"}`,
      `**Thread:** ${s.active.chat_thread_id ?? "none"}`,
      `**Voice Persona:** ${s.active.voice_persona_id ?? "none"}`,
      ``,
      `### Preferences`,
      `Voice input: ${s.preferences.voice_input_enabled ? "✅ on" : "❌ off"}`,
      `Voice reply: ${s.preferences.voice_reply_enabled ? "✅ on" : "❌ off"}`,
      `Smart formatting: ${s.preferences.smart_formatting_enabled ? "✅ on" : "❌ off"}`,
      `Relay: ${s.preferences.relay_enabled ? "✅ on" : "❌ off"}`,
      `Image generation: ${s.preferences.image_generation_enabled ? "✅ on" : "❌ off"}`,
      ``,
      `### Last Activity`,
      `**Run:** ${s.last.run_id ?? "none"}`,
      `**Trace:** ${s.last.trace_id ?? "none"}`,
      `**Relay:** ${s.last.relay_id ?? "none"}`,
      `**Artifact:** ${s.last.artifact_id ?? "none"}`,
      `**Message:** ${s.last.message_id ?? "none"}`,
      `**Waiting Status:** ${s.last.waiting_status_id ?? "none"}`,
      `**Realtime Stream:** ${s.last.realtime_stream_id ?? "none"}`,
      ``,
      `**Created:** ${s.timestamps.created_at}`,
      `**Last Activity:** ${s.timestamps.last_activity_at}`,
    ];

    return lines.join("\n");
  }

  renderStatus(session_id?: string): string {
    const s = this.store.get();
    if (!s) return "No session.";
    return [
      `Session: \`${s.session_id}\``,
      `Provider: ${s.active.provider_id ?? "-"}`,
      `Thread: ${s.active.chat_thread_id ?? "-"}`,
      `Voice: ${s.preferences.voice_input_enabled ? "in+" : "in-"} ${s.preferences.voice_reply_enabled ? "out+" : "out-"}`,
      `Persona: ${s.active.voice_persona_id ?? "-"}`,
    ].join(" · ");
  }
}
