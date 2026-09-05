import { STTAdapter } from "./stt-adapter.js";
import { VoiceArtifactStore } from "./voice-artifact-store.js";
import type { VoiceRuntimeInput, VoiceSurfaceKind } from "./voice-surface.types.js";

export interface VoiceInputResult {
  runtime_input: VoiceRuntimeInput;
  transcript: string;
  language: string;
  artifact_id: string;
}

export class VoiceInputHandler {
  readonly stt: STTAdapter;
  readonly artifactStore: VoiceArtifactStore;

  constructor(artifactStore?: VoiceArtifactStore) {
    this.stt = new STTAdapter();
    this.artifactStore = artifactStore ?? new VoiceArtifactStore();
  }

  async handle(input: VoiceRuntimeInput): Promise<VoiceInputResult> {
    if (!input.audio.local_path) {
      throw new Error("VoiceInputHandler requires audio.local_path");
    }

    const sttResult = await this.stt.transcribe(input.audio.local_path, input.language);

    const artifact_id = `voice_artifact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.artifactStore.record({
      artifact_id,
      input_id: input.input_id,
      surface: input.surface,
      kind: "stt_transcript",
      path: input.audio.local_path,
      mime_type: input.audio.mime_type,
      duration_sec: input.audio.duration_sec,
      transcript: sttResult.transcript,
      confidence: sttResult.confidence,
      created_at: new Date().toISOString(),
    });

    return {
      runtime_input: {
        ...input,
        transcript: sttResult.transcript,
        language: sttResult.language as VoiceRuntimeInput["language"],
      },
      transcript: sttResult.transcript,
      language: sttResult.language,
      artifact_id,
    };
  }
}
