import type { UnifiedTransport } from "./inbound.js";

export interface UnifiedOutboundMessage {
  transport: UnifiedTransport;
  tele_user_id: string;
  session_id?: string;
  text?: string;
  attachments?: Array<{
    kind: "text" | "file" | "image" | "link";
    value: string;
  }>;
  metadata?: Record<string, unknown>;
}
