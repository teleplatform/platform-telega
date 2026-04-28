export type VoiceMode = "stt" | "tts" | "duplex";

export type VoiceProviderId =
  | "arisha_local"
  | "arisha_cloud"
  | "alice_bridge"
  | "telegram_voice_surface";

export type VoiceTaskStatus =
  | "planned"
  | "queued"
  | "processing"
  | "done"
  | "failed";

export type VoiceRequest = {
  id: string;
  mode: VoiceMode;
  providerId: VoiceProviderId;
  inputText?: string;
  inputAudioRef?: string;
  voicePersona?: string | null;
  locale?: string | null;
  createdAt: number;
};

export type VoiceResult = {
  id: string;
  status: VoiceTaskStatus;
  providerId: VoiceProviderId;
  outputText?: string;
  outputAudioRef?: string;
  error?: string;
  finishedAt?: number;
};

export type VoiceProviderConfig = {
  id: VoiceProviderId;
  title: string;
  status: "active" | "planned" | "placeholder" | "disabled";
  direction: VoiceMode[];
  visibility: "creator" | "user" | "internal";
};

export interface VoiceRuntime {
  submit(request: VoiceRequest): Promise<VoiceResult>;
}
