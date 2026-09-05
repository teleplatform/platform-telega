export type OutputRelayKind = "text" | "markdown" | "code" | "image" | "mixed";

export type OutputRelayStatus =
  | "created"
  | "streaming"
  | "rendering"
  | "chunking"
  | "delivering"
  | "completed"
  | "partial"
  | "failed";

export interface OutputRelaySession {
  relay_id: string;
  run_id: string;
  trace_id: string;
  provider_id: string;
  chat_id: string;
  kind: OutputRelayKind;
  status: OutputRelayStatus;
  counters: {
    chars_seen: number;
    chars_delivered: number;
    chunks_delivered: number;
    images_detected: number;
  };
  timestamps: {
    created_at: string;
    last_change_at: string;
    last_heartbeat_at: string;
    completed_at?: string;
  };
}

export type OutputChunkKind = "text" | "markdown" | "code";

export interface OutputChunk {
  chunk_id: string;
  relay_id: string;
  index: number;
  total?: number;
  text: string;
  chars: number;
  kind: OutputChunkKind;
  delivered: boolean;
}

export interface ChunkingOptions {
  max_chars: number;
  preserve_markdown: boolean;
  preserve_code_fences: boolean;
  add_part_headers: boolean;
}

export interface WatchdogConfig {
  hard_timeout_ms: number;
  idle_timeout_text_ms: number;
  idle_timeout_image_ms: number;
  heartbeat_interval_ms: number;
  snapshot_interval_ms: number;
}

export const DEFAULT_WATCHDOG_CONFIG: WatchdogConfig = {
  hard_timeout_ms: 20 * 60 * 1000,
  idle_timeout_text_ms: 5 * 60 * 1000,
  idle_timeout_image_ms: 10 * 60 * 1000,
  heartbeat_interval_ms: 25_000,
  snapshot_interval_ms: 60_000,
};

export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  max_chars: 3500,
  preserve_markdown: true,
  preserve_code_fences: true,
  add_part_headers: true,
};
