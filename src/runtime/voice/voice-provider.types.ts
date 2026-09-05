/**
 * TGR-6.33 — Voice Provider Router
 * Types and contracts for the Voice Provider layer.
 *
 * Canon: Tele•GPT is the brain. Voice providers are replaceable adapters.
 */

export type VoiceTaskKind =
  | "stt"
  | "tts"
  | "streaming_stt"
  | "streaming_tts"
  | "duplex";

export type VoiceProviderId =
  | "local_whisper_stt"
  | "faster_whisper_stt"
  | "openai_whisper_stt"
  | "yandex_speechkit_stt"
  | "local_tts"
  | "silero_tts"
  | "xtts_tts"
  | "supertone_tts"
  | "openai_tts"
  | "yandex_speechkit_tts";

export type VoiceProviderMode = "local" | "api" | "hybrid";
export type CostTier = "free" | "low" | "medium" | "high";
export type LatencyTier = "fast" | "normal" | "slow";
export type QualityTier = "basic" | "good" | "high";
export type VoiceHealthStatus = "healthy" | "degraded" | "unavailable" | "unknown";

export interface VoiceProviderProfile {
  id: VoiceProviderId;
  taskKind: VoiceTaskKind[];
  displayName: string;
  mode: VoiceProviderMode;
  /** BCP-47 language codes this provider supports well */
  languages: string[];
  strengths: string[];
  costTier: CostTier;
  latencyTier: LatencyTier;
  qualityTier: QualityTier;
  supportsStreaming: boolean;
  supportsRealtime: boolean;
  enabled: boolean;
}

export interface VoiceOrchestratorRequest {
  taskKind: VoiceTaskKind;
  language?: string;           // BCP-47, e.g. "ru", "en", "uz"
  preferredProvider?: VoiceProviderId | null;
  requireStreaming?: boolean;
  requireRealtime?: boolean;
  requireLocal?: boolean;      // privacy: never send audio to cloud
  preferFast?: boolean;
  traceId: string;
}

export interface VoiceProviderScore {
  provider: VoiceProviderId;
  score: number;
  available: boolean;
  healthStatus: VoiceHealthStatus;
  healthReason: string;
  reasons: string[];
}

export interface VoiceOrchestratorDecision {
  selected: VoiceProviderId;
  fallbackChain: VoiceProviderId[];
  scores: VoiceProviderScore[];
  traceId: string;
  decidedAt: number;
  reason: string;
}

export interface VoiceExecutionAttempt {
  provider: VoiceProviderId;
  startedAt: number;
  finishedAt: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  outputBytes?: number;
}

export interface VoiceExecutionTrace {
  traceId: string;
  request: VoiceOrchestratorRequest;
  decision: VoiceOrchestratorDecision;
  attempts: VoiceExecutionAttempt[];
  finalProvider: VoiceProviderId;
  totalLatencyMs: number;
  fallbackCount: number;
  success: boolean;
}
