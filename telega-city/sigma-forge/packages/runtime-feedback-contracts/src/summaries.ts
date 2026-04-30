export interface SessionFeedbackSummary {
  session_id: string;
  total_events: number;
  success_count: number;
  failure_count: number;
  recovered_count: number;
  fallback_count: number;
  retry_count: number;
  severity_breakdown: { low: number; medium: number; high: number };
  last_event_at?: string;
}

export interface RouteFeedbackSummary {
  route_id: string;
  total_events: number;
  success_count: number;
  failure_count: number;
  recovered_count: number;
  fallback_count: number;
  recovery_success_rate: number;
  degradation_count: number;
}
