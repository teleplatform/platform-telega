import type { TextToSpeechRequest, TextToSpeechResult } from "./voice-surface.types.js";

export interface TTSProvider {
  readonly provider_id: string;
  synthesize(request: TextToSpeechRequest): Promise<TextToSpeechResult>;
}

export class TTSAdapter {
  private providers: TTSProvider[] = [];

  register(provider: TTSProvider): void {
    this.providers.push(provider);
  }

  async synthesize(request: TextToSpeechRequest): Promise<TextToSpeechResult> {
    for (const p of this.providers) {
      try {
        return await p.synthesize(request);
      } catch {
        continue;
      }
    }
    throw new Error("All TTS providers failed");
  }
}

export class StubTTSProvider implements TTSProvider {
  readonly provider_id = "stub_tts";

  async synthesize(request: TextToSpeechRequest): Promise<TextToSpeechResult> {
    const audio_path = `/tmp/stub_tts_${Date.now()}.${request.format}`;
    const mime_type = request.format === "ogg" ? "audio/ogg" : request.format === "mp3" ? "audio/mpeg" : "audio/wav";
    return {
      audio_path,
      mime_type,
      duration_sec: request.text.length * 0.05,
      persona_id: request.persona_id,
    };
  }
}
