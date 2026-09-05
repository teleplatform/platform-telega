export { VoiceInputHandler } from "./voice-input-handler.js";
export type { VoiceInputResult } from "./voice-input-handler.js";
export { STTAdapter, StubSTTProvider } from "./stt-adapter.js";
export type { STTProvider } from "./stt-adapter.js";
export { TTSAdapter, StubTTSProvider } from "./tts-adapter.js";
export type { TTSProvider } from "./tts-adapter.js";
export { VoiceAnswerComposer } from "./voice-answer-composer.js";
export type { VoiceAnswerResult, VoiceAnswerConfig } from "./voice-answer-composer.js";
export { VoicePersonaRegistry } from "./voice-persona-registry.js";
export type { VoicePersonaId } from "./voice-persona-registry.js";
export { VoiceArtifactStore } from "./voice-artifact-store.js";
export { AliceBridgeSurface } from "./alice-bridge-surface.js";
export type { AliceBridgeSurfaceConfig } from "./alice-bridge-surface.js";
export { ArishaVoicePersona } from "./personas/arisha.persona.js";
export type {
  VoiceSurfaceKind,
  VoiceRuntimeInput,
  SpeechToTextResult,
  TextToSpeechRequest,
  TextToSpeechResult,
  VoicePersonaProfile,
  VoiceArtifact,
  AliceBridgeRequest,
  AliceBridgeResponse,
  TTSFormat,
} from "./voice-surface.types.js";
