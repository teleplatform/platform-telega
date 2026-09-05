/**
 * TGR-6.33 — Voice Provider Registry
 * Static profiles for all STT/TTS providers.
 */

import type { VoiceProviderProfile, VoiceProviderId } from "./voice-provider.types.js";

export const VOICE_PROVIDER_PROFILES: VoiceProviderProfile[] = [
  // ── STT providers ──────────────────────────────────────────────────────────
  {
    id: "yandex_speechkit_stt",
    taskKind: ["stt", "streaming_stt"],
    displayName: "Yandex SpeechKit STT",
    mode: "api",
    languages: ["ru", "uz", "kk", "en"],
    strengths: ["russian", "uzbek", "realtime", "streaming"],
    costTier: "low",
    latencyTier: "fast",
    qualityTier: "high",
    supportsStreaming: true,
    supportsRealtime: true,
    enabled: true,
  },
  {
    id: "faster_whisper_stt",
    taskKind: ["stt", "streaming_stt"],
    displayName: "Faster Whisper (local)",
    mode: "local",
    languages: ["ru", "en", "uz", "de", "fr", "es", "zh"],
    strengths: ["multilingual", "offline", "privacy", "fast"],
    costTier: "free",
    latencyTier: "fast",
    qualityTier: "good",
    supportsStreaming: true,
    supportsRealtime: false,
    enabled: true,
  },
  {
    id: "local_whisper_stt",
    taskKind: ["stt"],
    displayName: "Whisper (local)",
    mode: "local",
    languages: ["ru", "en", "uz", "de", "fr", "es", "zh"],
    strengths: ["multilingual", "offline", "privacy"],
    costTier: "free",
    latencyTier: "normal",
    qualityTier: "good",
    supportsStreaming: false,
    supportsRealtime: false,
    enabled: true,
  },
  {
    id: "openai_whisper_stt",
    taskKind: ["stt"],
    displayName: "OpenAI Whisper API",
    mode: "api",
    languages: ["ru", "en", "uz", "de", "fr", "es", "zh"],
    strengths: ["multilingual", "accuracy"],
    costTier: "low",
    latencyTier: "normal",
    qualityTier: "high",
    supportsStreaming: false,
    supportsRealtime: false,
    enabled: true,
  },

  // ── TTS providers ──────────────────────────────────────────────────────────
  {
    id: "yandex_speechkit_tts",
    taskKind: ["tts", "streaming_tts"],
    displayName: "Yandex SpeechKit TTS",
    mode: "api",
    languages: ["ru", "uz", "kk", "en"],
    strengths: ["russian", "uzbek", "natural", "streaming"],
    costTier: "low",
    latencyTier: "fast",
    qualityTier: "high",
    supportsStreaming: true,
    supportsRealtime: true,
    enabled: true,
  },
  {
    id: "silero_tts",
    taskKind: ["tts"],
    displayName: "Silero TTS (local)",
    mode: "local",
    languages: ["ru", "en", "de", "es", "fr"],
    strengths: ["russian", "offline", "privacy", "fast"],
    costTier: "free",
    latencyTier: "fast",
    qualityTier: "good",
    supportsStreaming: false,
    supportsRealtime: false,
    enabled: true,
  },
  {
    id: "supertone_tts",
    taskKind: ["tts"],
    displayName: "Supertone (local)",
    mode: "local",
    languages: ["ru", "en", "uz"],
    strengths: ["russian", "uzbek", "offline", "privacy", "natural"],
    costTier: "free",
    latencyTier: "fast",
    qualityTier: "high",
    supportsStreaming: false,
    supportsRealtime: false,
    enabled: true,
  },
  {
    id: "xtts_tts",
    taskKind: ["tts", "streaming_tts"],
    displayName: "XTTS (local)",
    mode: "local",
    languages: ["ru", "en", "de", "fr", "es", "zh"],
    strengths: ["multilingual", "offline", "privacy", "voice-cloning"],
    costTier: "free",
    latencyTier: "normal",
    qualityTier: "high",
    supportsStreaming: true,
    supportsRealtime: false,
    enabled: true,
  },
  {
    id: "openai_tts",
    taskKind: ["tts"],
    displayName: "OpenAI TTS",
    mode: "api",
    languages: ["ru", "en", "de", "fr", "es", "zh"],
    strengths: ["multilingual", "natural", "quality"],
    costTier: "low",
    latencyTier: "normal",
    qualityTier: "high",
    supportsStreaming: false,
    supportsRealtime: false,
    enabled: true,
  },
  {
    id: "local_tts",
    taskKind: ["tts"],
    displayName: "Local TTS (fallback)",
    mode: "local",
    languages: ["ru", "en"],
    strengths: ["offline", "privacy", "fallback"],
    costTier: "free",
    latencyTier: "fast",
    qualityTier: "basic",
    supportsStreaming: false,
    supportsRealtime: false,
    enabled: true,
  },
];

export class VoiceProviderRegistry {
  private profiles = new Map<VoiceProviderId, VoiceProviderProfile>();

  constructor() {
    for (const p of VOICE_PROVIDER_PROFILES) {
      this.profiles.set(p.id, p);
    }
  }

  get(id: VoiceProviderId): VoiceProviderProfile | undefined {
    return this.profiles.get(id);
  }

  list(): VoiceProviderProfile[] {
    return Array.from(this.profiles.values());
  }

  listEnabled(): VoiceProviderProfile[] {
    const localEnabled = process.env.TELEGPT_LOCAL_ENABLED !== "false";
    return this.list().filter(p => {
      if (!p.enabled) return false;
      if (!localEnabled && p.mode === "local") return false;
      return true;
    });
  }

  listByTask(taskKind: string): VoiceProviderProfile[] {
    return this.listEnabled().filter(p => p.taskKind.includes(taskKind as any));
  }

  enable(id: VoiceProviderId): void {
    const p = this.profiles.get(id);
    if (p) p.enabled = true;
  }

  disable(id: VoiceProviderId): void {
    const p = this.profiles.get(id);
    if (p) p.enabled = false;
  }
}

/** Canonical fallback chains per task + language */
export const VOICE_FALLBACK_CHAINS: Record<string, VoiceProviderId[]> = {
  "stt:ru":  ["openai_whisper_stt", "yandex_speechkit_stt", "faster_whisper_stt", "local_whisper_stt"],
  "stt:uz":  ["openai_whisper_stt", "yandex_speechkit_stt", "faster_whisper_stt"],
  "stt:en":  ["openai_whisper_stt", "faster_whisper_stt", "local_whisper_stt", "yandex_speechkit_stt"],
  "stt:*":   ["openai_whisper_stt", "faster_whisper_stt", "local_whisper_stt"],
  "tts:ru":  ["openai_tts", "yandex_speechkit_tts", "supertone_tts", "silero_tts", "xtts_tts", "local_tts"],
  "tts:uz":  ["openai_tts", "supertone_tts", "yandex_speechkit_tts", "xtts_tts", "local_tts"],
  "tts:en":  ["openai_tts", "xtts_tts", "supertone_tts", "silero_tts", "local_tts"],
  "tts:*":   ["openai_tts", "xtts_tts", "supertone_tts", "silero_tts", "local_tts"],
};

export function getVoiceFallbackChain(
  taskKind: "stt" | "tts",
  language?: string,
  requireLocal?: boolean
): VoiceProviderId[] {
  if (requireLocal) {
    return taskKind === "stt"
      ? ["faster_whisper_stt", "local_whisper_stt"]
      : ["supertone_tts", "xtts_tts", "silero_tts", "local_tts"];
  }
  const key = `${taskKind}:${language ?? "*"}`;
  return VOICE_FALLBACK_CHAINS[key] ?? VOICE_FALLBACK_CHAINS[`${taskKind}:*`] ?? [];
}
