import type { SpeechToTextResult } from "./voice-surface.types.js";

export interface STTProvider {
  readonly provider_id: string;
  transcribe(audioPath: string, language?: string): Promise<SpeechToTextResult>;
}

export class STTAdapter {
  private providers: STTProvider[] = [];

  register(provider: STTProvider): void {
    this.providers.push(provider);
  }

  async transcribe(audioPath: string, language?: string): Promise<SpeechToTextResult> {
    for (const p of this.providers) {
      try {
        return await p.transcribe(audioPath, language);
      } catch {
        continue;
      }
    }
    throw new Error("All STT providers failed");
  }
}

export class StubSTTProvider implements STTProvider {
  readonly provider_id = "stub_stt";

  async transcribe(_audioPath: string, language?: string): Promise<SpeechToTextResult> {
    return {
      transcript: "This is a stub transcription for testing purposes.",
      language: language ?? "en",
      confidence: 0.95,
    };
  }
}
