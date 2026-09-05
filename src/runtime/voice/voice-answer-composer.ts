import { TTSAdapter } from "./tts-adapter.js";
import { VoicePersonaRegistry } from "./voice-persona-registry.js";
import { VoiceArtifactStore } from "./voice-artifact-store.js";
import type { VoiceSurfaceKind, TTSFormat } from "./voice-surface.types.js";

export interface VoiceAnswerConfig {
  voice_reply_enabled: boolean;
  default_persona_id: string;
  default_format: TTSFormat;
  default_language: "ru" | "uz" | "en";
}

export interface VoiceAnswerResult {
  text: string;
  audio_artifact_id?: string;
  audio_path?: string;
  persona_id: string;
}

export class VoiceAnswerComposer {
  readonly tts: TTSAdapter;
  readonly personaRegistry: VoicePersonaRegistry;
  readonly artifactStore: VoiceArtifactStore;
  config: VoiceAnswerConfig;

  constructor(
    tts?: TTSAdapter,
    personaRegistry?: VoicePersonaRegistry,
    artifactStore?: VoiceArtifactStore,
    config?: Partial<VoiceAnswerConfig>,
  ) {
    this.tts = tts ?? new TTSAdapter();
    this.personaRegistry = personaRegistry ?? new VoicePersonaRegistry();
    this.artifactStore = artifactStore ?? new VoiceArtifactStore();
    this.config = {
      voice_reply_enabled: false,
      default_persona_id: "arisha",
      default_format: "ogg",
      default_language: "en",
      ...config,
    };
  }

  async compose(
    text: string,
    surface: VoiceSurfaceKind,
    personaId?: string,
    language?: "ru" | "uz" | "en",
  ): Promise<VoiceAnswerResult> {
    const pid = personaId ?? this.config.default_persona_id;
    const lang = language ?? this.config.default_language;

    const result: VoiceAnswerResult = {
      text,
      persona_id: pid,
    };

    if (!this.config.voice_reply_enabled) {
      return result;
    }

    const persona = this.personaRegistry.get(pid);
    const ttsRequest = {
      text,
      persona_id: pid,
      language: lang,
      format: this.config.default_format,
      speed: persona?.tts.speed,
      pitch: persona?.tts.pitch,
    };

    const ttsResult = await this.tts.synthesize(ttsRequest);

    const artifact_id = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.artifactStore.record({
      artifact_id,
      surface,
      kind: "tts_audio",
      path: ttsResult.audio_path,
      mime_type: ttsResult.mime_type,
      duration_sec: ttsResult.duration_sec,
      persona_id: pid,
      created_at: new Date().toISOString(),
    });

    result.audio_artifact_id = artifact_id;
    result.audio_path = ttsResult.audio_path;
    return result;
  }
}
