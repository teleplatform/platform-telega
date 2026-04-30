export type UnifiedTransport =
  | "telegram"
  | "web"
  | "miniapp"
  | "tgm"
  | "max";

export interface UnifiedAttachment {
  kind: "image" | "audio" | "file" | "video";
  ref: string;
}

export interface UnifiedInboundEvent {
  transport: UnifiedTransport;
  tele_user_id: string;
  workspace_id?: string;
  session_id?: string;
  text?: string;
  attachments?: UnifiedAttachment[];
  metadata?: Record<string, unknown>;
}
