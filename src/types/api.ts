export type ApiErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
};

export type ApiErrorResponse = {
  trace_id: string;
  error: ApiError;
};

export type AskRequest = {
  message: string;
  user_id?: string;
  model?: string;
};

export type AskResponse = {
  trace_id: string;
  reply: string;
  mode: "echo" | "openai";
  meta?: {
    provider: "local" | "openai";
    model?: string;
    duration_ms: number;
  };
};

export type TraceRecord = {
  trace_id: string;
  message: string;
  reply: string;
  mode: "echo" | "openai";
  provider: "local" | "openai";
  model?: string;
  user_id?: string;
  created_at: number;
  ok: 1 | 0;
  duration_ms?: number;
  latency_ms?: number;
  request_bytes?: number;
  reply_bytes?: number;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  error_code?: ApiErrorCode;
  error_message?: string;
};

export type TraceListResponse = {
  items: TraceRecord[];
};

export type BuildTaskStatus = "queued" | "running" | "done" | "partial" | "blocked";
export type BuildTaskVisibility = "public" | "creator" | "core";

export type BuildTaskListItem = {
  task_id: string;
  status: BuildTaskStatus;
  visibility: BuildTaskVisibility;
  title: string;
  created_at: number;
  updated_at: number;
  heartbeat_at?: number | null;
  heartbeat_age_ms?: number | null;
  progress?: number | null;
  stale?: boolean;
};

export type BuildTaskListResponse = {
  server_time_ms: number;
  poll_after_ms: number;
  items: BuildTaskListItem[];
};

export type BuildTaskCounts = {
  queued: number;
  running: number;
  done: number;
  partial: number;
  blocked: number;
};

export type BuildTaskSummaryResponse = {
  server_time_ms: number;
  poll_after_ms: number;
  stale_running: number;
  counts: BuildTaskCounts;
};

export type BuildTaskDetailResponse = BuildTaskListItem & {
  task_json: unknown | null;
  result_json: unknown | null;
  error_code?: string | null;
  error_message?: string | null;
};
