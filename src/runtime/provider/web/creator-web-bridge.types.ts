export interface CreatorWebBridgeRequest {
  run_id: string;
  trace_id: string;
  provider_id: "openai:web" | "qwen:web" | "deepseek:web";
  prompt: string;
  runtime_mode: "creator";
  options: {
    max_wait_ms: number;
    require_final_answer: boolean;
    preserve_code_blocks: boolean;
    relay?: boolean;
    onStreamUpdate?: (tail: string, fullText: string) => void;
  };
}

export interface CreatorWebBridgeRelayInfo {
  relay_id: string;
  chars_seen: number;
  chars_delivered: number;
  chunks_delivered: number;
}

export type CreatorWebBridgeStatus =
  | "done"
  | "partial"
  | "blocked_login"
  | "blocked_captcha"
  | "blocked_rate_limit"
  | "timeout"
  | "failed";

export interface CreatorWebBridgeResult {
  provider_id: string;
  status: CreatorWebBridgeStatus;
  output: {
    text: string;
    markdown?: string;
    code_blocks?: Array<{ language: string; content: string }>;
  };
  evidence: {
    session_id: string;
    url: string;
    extraction_method: "dom" | "clipboard" | "accessibility" | "snapshot";
    screenshot_path?: string;
    html_snapshot_path?: string;
  };
  relay?: CreatorWebBridgeRelayInfo;
}
