// ─────────────────────────────────────────────────────────────
// UNIFIED TRANSPORT CONTRACT
//
// ONE contract for all surfaces:
// - Telegram
// - Web
// - Alice
// - API
//
// NO surface-specific types. NO business logic.
// ─────────────────────────────────────────────────────────────

export type TransportInputType = "text" | "voice" | "file" | "action";

export interface TransportTextInput {
  type: "text";
  text: string;
  userId: string;
  chatId?: string;
  messageId?: string;
  surface: "telegram" | "web" | "alice" | "api" | "bridge";
}

export interface TransportVoiceInput {
  type: "voice";
  fileId: string;
  userId: string;
  chatId?: string;
  duration?: number;
  surface: "telegram" | "web" | "alice" | "api" | "bridge";
}

export interface TransportFileInput {
  type: "file";
  fileId: string;
  fileName?: string;
  mimeType?: string;
  userId: string;
  chatId?: string;
  size?: number;
  surface: "telegram" | "web" | "alice" | "api" | "bridge";
}

export interface TransportActionInput {
  type: "action";
  action: string;
  payload?: Record<string, unknown>;
  userId: string;
  chatId?: string;
  surface: "telegram" | "web" | "alice" | "api" | "bridge";
}

export type TransportInput =
  | TransportTextInput
  | TransportVoiceInput
  | TransportFileInput
  | TransportActionInput;

export type TransportOutputType = "text" | "audio" | "file" | "image" | "actions";

export interface TransportTextOutput {
  type: "text";
  text: string;
  parseMode?: "markdown" | "html";
}

export interface TransportAudioOutput {
  type: "audio";
  buffer: Buffer;
  duration?: number;
  mimeType?: string;
}

export interface TransportFileOutput {
  type: "file";
  buffer: Buffer;
  filename: string;
  caption?: string;
  mimeType?: string;
}

export interface TransportImageOutput {
  type: "image";
  url?: string;
  buffer?: Buffer;
  caption?: string;
}

export interface TransportActionsOutput {
  type: "actions";
  actions: TransportUiAction[];
}

export type TransportOutput =
  | TransportTextOutput
  | TransportAudioOutput
  | TransportFileOutput
  | TransportImageOutput
  | TransportActionsOutput;

export interface TransportUiAction {
  id: string;
  label: string;
  kind: "primary" | "secondary" | "ghost" | "url";
  payload?: Record<string, unknown>;
}

export interface TransportDeliveryResult {
  ok: boolean;
  messageId?: string | number;
  error?: string;
}