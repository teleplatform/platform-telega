export type VoiceLang = "ru" | "uz" | "en" | "auto";

export type CoreStatus = "done" | "partial" | "blocked";

export type VoiceTrace = {
  lane: string;
  provider_used?: string;
  duration_ms?: number;
  input_audio_sha256?: string;
};

export type VoiceResponseBase = {
  status: CoreStatus;
  warnings?: string[];
  trace?: VoiceTrace;
};

export type AuthContext = {
  userId: string;
  roles: string[];
};

export type VoiceCloneRequest = {
  job_id: string;
  provider?: "local.cosyvoice.v3";
  audio: { content_base64: string; mime: string; filename?: string; trim_to_seconds?: number };
  consent: { declared_owner_or_permission: boolean };
  meta?: { voice_label?: string; lang_hint?: VoiceLang };
};

export type VoiceCloneResponse = VoiceResponseBase & {
  voice_id?: string;
  embedding_ref?: string;
};

export type VoiceSpeakRequest = {
  job_id: string;
  provider?: string;
  text: string;
  voice: { type: "base" | "cloned"; base_voice?: string; voice_id?: string };
  lang?: VoiceLang;
  seed?: number;
  format?: { container?: "wav"; sample_rate?: 16000 | 22050 | 44100 };
};

export type VoiceSpeakResponse = VoiceResponseBase & {
  audio_base64?: string;
  mime?: string;
};

export type VoiceConvertRequest = {
  job_id: string;
  provider?: "local.cosyvoice.v3";
  source_audio: { content_base64: string; mime: string; filename?: string; trim_to_seconds?: number };
  target: { voice_id: string };
  lang?: VoiceLang;
};

export type VoiceDialogueRequest = {
  job_id: string;
  provider?: "local.cosyvoice.v3";
  script: Array<{ speaker: "A" | "B"; text: string }>;
  voices: { A: { voice_id: string }; B: { voice_id: string } };
  lang?: VoiceLang;
  format?: { container?: "wav"; sample_rate?: 16000 | 22050 | 44100 };
};
