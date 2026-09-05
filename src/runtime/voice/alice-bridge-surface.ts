import { VoiceInputHandler } from "./voice-input-handler.js";
import { VoiceAnswerComposer } from "./voice-answer-composer.js";
import { VoicePersonaRegistry } from "./voice-persona-registry.js";
import { VoiceArtifactStore } from "./voice-artifact-store.js";
import type {
  AliceBridgeRequest,
  AliceBridgeResponse,
  VoiceRuntimeInput,
} from "./voice-surface.types.js";

export interface AliceBridgeSurfaceConfig {
  default_persona_id: string;
  default_language: "ru-RU" | "uz-UZ" | "en-US";
}

export class AliceBridgeSurface {
  readonly inputHandler: VoiceInputHandler;
  readonly answerComposer: VoiceAnswerComposer;
  readonly personaRegistry: VoicePersonaRegistry;
  readonly artifactStore: VoiceArtifactStore;
  config: AliceBridgeSurfaceConfig;

  constructor(
    inputHandler?: VoiceInputHandler,
    answerComposer?: VoiceAnswerComposer,
    personaRegistry?: VoicePersonaRegistry,
    artifactStore?: VoiceArtifactStore,
    config?: Partial<AliceBridgeSurfaceConfig>,
  ) {
    this.inputHandler = inputHandler ?? new VoiceInputHandler();
    this.answerComposer = answerComposer ?? new VoiceAnswerComposer();
    this.personaRegistry = personaRegistry ?? new VoicePersonaRegistry();
    this.artifactStore = artifactStore ?? new VoiceArtifactStore();
    this.config = {
      default_persona_id: "arisha",
      default_language: "ru-RU",
      ...config,
    };
  }

  async handleRequest(request: AliceBridgeRequest): Promise<AliceBridgeResponse> {
    const voiceInput: VoiceRuntimeInput = {
      input_id: `alice_${request.session_id}_${Date.now()}`,
      user_id: request.user_id,
      surface: "alice_bridge",
      type: "voice",
      audio: {
        file_id: undefined,
        local_path: request.audio_path,
        mime_type: "audio/ogg",
      },
      transcript: request.utterance,
      language: this.mapLocale(request.locale),
    };

    let transcript = request.utterance ?? "";
    if (request.audio_path && !transcript) {
      const handled = await this.inputHandler.handle(voiceInput);
      transcript = handled.transcript;
    }

    const lang = this.localeToTTSLang(request.locale);
    const answer = await this.answerComposer.compose(transcript, "alice_bridge", undefined, lang);

    return {
      session_id: request.session_id,
      text: answer.text,
      audio_path: answer.audio_path,
      persona_id: answer.persona_id,
    };
  }

  private mapLocale(locale: "ru-RU" | "uz-UZ" | "en-US"): "ru" | "uz" | "en" {
    if (locale === "ru-RU") return "ru";
    if (locale === "uz-UZ") return "uz";
    return "en";
  }

  private localeToTTSLang(locale: "ru-RU" | "uz-UZ" | "en-US"): "ru" | "uz" | "en" {
    return this.mapLocale(locale);
  }
}
