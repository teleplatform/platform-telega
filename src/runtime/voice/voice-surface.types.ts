export type VoiceSurfaceKind =
  | "telegram_voice"
  | "alice_bridge"
  | "web_voice"
  | "mobile_voice"
  | "desktop_voice";

export type TTSFormat = "ogg" | "mp3" | "wav";

export interface VoiceRuntimeInput {
  input_id: string;
  user_id: string;
  surface: VoiceSurfaceKind;
  type: "voice";
  audio: {
    file_id?: string;
    local_path?: string;
    mime_type: "audio/ogg" | "audio/mpeg" | "audio/wav" | "audio/webm";
    duration_sec?: number;
  };
  transcript?: string;
  language?: "ru" | "uz" | "en" | "auto";
}

export interface SpeechToTextResult {
  transcript: string;
  language: string;
  confidence: number;
  segments?: Array<{
    start_sec: number;
    end_sec: number;
    text: string;
  }>;
}

export interface TextToSpeechRequest {
  text: string;
  persona_id: string;
  language: "ru" | "uz" | "en";
  format: TTSFormat;
  speed?: number;
  pitch?: number;
}

export interface TextToSpeechResult {
  audio_path: string;
  mime_type: string;
  duration_sec?: number;
  persona_id: string;
}

export interface VoicePersonaProfile {
  persona_id: string;
  display_name: string;
  role: string;
  languages: string[];
  style: {
    tone: string;
    pace: string;
    clarity: string;
    emotionality: string;
  };
  tts: {
    engine: string;
    voice: string;
    speed: number;
    pitch: number;
  };
}

export interface AliceBridgeRequest {
  session_id: string;
  user_id: string;
  utterance?: string;
  audio_path?: string;
  locale: "ru-RU" | "uz-UZ" | "en-US";
}

export interface AliceBridgeResponse {
  session_id: string;
  text: string;
  audio_path?: string;
  persona_id?: string;
}

export interface VoiceArtifact {
  artifact_id: string;
  input_id?: string;
  surface: VoiceSurfaceKind;
  kind: "stt_transcript" | "tts_audio";
  path: string;
  mime_type: string;
  duration_sec?: number;
  transcript?: string;
  confidence?: number;
  persona_id?: string;
  created_at: string;
}
