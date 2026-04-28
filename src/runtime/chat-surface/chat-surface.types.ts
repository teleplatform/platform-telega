export type InputType = "text" | "voice" | "file" | "image";
export type OutputType = "text" | "voice" | "file" | "image" | "mixed";

export interface InputPayload {
  type: InputType;
  text?: string;
  voiceFileId?: string;
  fileId?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  imageFileId?: string;
  chatId?: string | number;
  userId?: string | number;
}

export interface OutputPayload {
  type: OutputType;
  text?: string;
  voiceFileId?: string;
  fileId?: string;
  fileUrl?: string;
  fileName?: string;
  preview?: string;
}

export interface ChatAction {
  id: string;
  type: ChatActionType;
  userId: string | number;
  chatId: string | number;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export type ChatActionType =
  | "new_chat"
  | "rename_chat"
  | "archive_chat"
  | "delete_chat"
  | "upload_file"
  | "generate_image"
  | "read_aloud"
  | "voice_input"
  | "export_chat"
  | "prefix_fix";

export interface FileIngestResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  content: string;
  normalized: boolean;
  tokens?: number;
}

export interface AutoFileConfig {
  maxPreviewLength: number;
  maxTokensPerFile: number;
  supportedMimeTypes: string[];
  fallbackEnabled: boolean;
}

export interface VoiceConfig {
  voiceId: string;
  model: "tts-1" | "tts-1-hd";
  speed: number;
}

export const DEFAULT_FILE_CONFIG: AutoFileConfig = {
  maxPreviewLength: 500,
  maxTokensPerFile: 150000,
  supportedMimeTypes: [
    "text/plain",
    "text/markdown",
    "application/json",
    "application/javascript",
    "text/typescript",
    "application/pdf",
    "text/csv",
    "application/xml",
    "text/html",
  ],
  fallbackEnabled: true,
};

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  voiceId: "alloy",
  model: "tts-1",
  speed: 1.0,
};

export const LONG_OUTPUT_THRESHOLD = 4000;

export interface CapabilityGroup {
  owner: string[];
  partner: string[];
  public: string[];
}

export const CHAT_SURFACE_CAPABILITIES: CapabilityGroup = {
  owner: [
    "voice_input",
    "read_aloud",
    "voice_output",
    "file_upload",
    "file_reading",
    "auto_file_fallback",
    "image_generation",
    "all_chat_actions",
  ],
  partner: [
    "voice_input",
    "read_aloud",
    "file_upload",
    "file_reading",
    "image_generation",
    "safe_chat_actions",
  ],
  public: [
    "file_upload",
    "image_generation",
  ],
};