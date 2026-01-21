import type { IntentType } from "./agent.js";
import type { Lane } from "../core/policyRouter.js";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "STATUS_CONFLICT"
  | "KNOWLEDGE_CONFLICT"
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

    // Policy/router
    lane?: Lane;
    lane_source?: "override" | "default";
    policy_override_used?: boolean;

    // Intent
    intent?: IntentType;
    intent_confidence?: number;
    intent_source?: "keyword" | "llm";
    intent_reason?: string;

    // LLM fallback accounting
    fallback_used?: boolean;
    failures_count?: number;
    attempt_number?: number;
    max_tokens?: number;
    timeout_ms?: number;

    // KB-2
    knowledge_source?: "db" | "file" | "none";
    knowledge_business_id?: string;
    knowledge_version?: number | null;

    // G2F
    generated_task_id?: string;
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

  // KB-2 (stored on traces)
  knowledge_source?: "db" | "file" | "none" | null;
  knowledge_business_id?: string | null;
  knowledge_version?: number | null;
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
