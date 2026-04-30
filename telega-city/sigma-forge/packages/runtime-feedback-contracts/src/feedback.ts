export type FeedbackEventType =
  | "execution_completed"
  | "execution_failed"
  | "fallback_triggered"
  | "replay_used"
  | "recovery_succeeded"
  | "recovery_failed"
  | "manual_takeover"
  | "timeout_occurred"
  | "tool_failure"
  | "route_mismatch"
  | "transport_degraded"
  | "user_positive_signal"
  | "user_negative_signal"
  | "retry_requested";

export type FeedbackOutcome = "success" | "failure" | "partial" | "recovered";
export type FeedbackSeverity = "low" | "medium" | "high";

export interface FeedbackEvent {
  event_id: string;
  session_id?: string;
  trace_id?: string;
  user_id?: string;
  core_user_id?: string;
  transport?: string;
  route_id?: string;
  tool_id?: string;
  event_type: FeedbackEventType;
  outcome?: FeedbackOutcome;
  severity?: FeedbackSeverity;
  reason_code?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}
