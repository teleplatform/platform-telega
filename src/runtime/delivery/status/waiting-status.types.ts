export const CREATE_WAITING_STATUS_DELAY_MS = 3500;
export const WAITING_STATUS_THROTTLE_MS = 15000;
export const WAITING_STATUS_IDLE_TIMEOUT_MS = 60000;

export type StatusKind =
  | "streaming_text"
  | "image_generation"
  | "relay"
  | "bridge"
  | "completed"
  | "failed";

export interface StatusProgress {
  kind: StatusKind;
  charCount?: number;
  part?: number;
  totalParts?: number;
  prompt?: string;
  message?: string;
  elapsedMs?: number;
  publicMode?: boolean;
}

export interface StatusTransport {
  send(text: string): Promise<{ messageId: number }>;
  edit(messageId: number, text: string): Promise<void>;
  delete(messageId: number): Promise<void>;
}

export type WaitingStatusState = "idle" | "pending" | "active" | "completed" | "failed";

export const TELEGPT_SHORT = "TeleGPT";
export const TELEGPT_FULL = "TeleGPT (Москвич 412)";
