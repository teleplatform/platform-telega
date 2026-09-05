import type { VoiceArtifact, VoiceSurfaceKind } from "./voice-surface.types.js";

export class VoiceArtifactStore {
  private artifacts: VoiceArtifact[] = [];

  record(artifact: VoiceArtifact): void {
    this.artifacts.push(artifact);
  }

  get(artifact_id: string): VoiceArtifact | undefined {
    return this.artifacts.find((a) => a.artifact_id === artifact_id);
  }

  listRecent(limit = 20): VoiceArtifact[] {
    return [...this.artifacts].reverse().slice(0, limit);
  }

  listBySurface(surface: VoiceSurfaceKind): VoiceArtifact[] {
    return this.artifacts.filter((a) => a.surface === surface);
  }

  listByKind(kind: "stt_transcript" | "tts_audio"): VoiceArtifact[] {
    return this.artifacts.filter((a) => a.kind === kind);
  }

  formatList(artifacts: VoiceArtifact[]): string {
    if (artifacts.length === 0) return "No voice artifacts recorded yet.";
    return artifacts.map((a) => {
      const label = a.kind === "stt_transcript" ? "STT" : "TTS";
      const detail = a.transcript ? ` "${a.transcript.slice(0, 60)}..."` : "";
      return `- [${label}] \`${a.artifact_id}\` (${a.mime_type})${detail}`;
    }).join("\n");
  }
}
