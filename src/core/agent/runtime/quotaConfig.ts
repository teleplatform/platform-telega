// Quota Configuration - Per Session / Per Subject Limits

/**
 * Quota configuration for agent sessions
 */
export interface QuotaConfig {
  // Per session limits
  maxStepsPerSession: number;
  maxTraceEvents: number;
  maxEvidenceBytes: number;
  maxSessionDurationMs: number;

  // Per subject limits (optional, for future use)
  maxSessionsPerSubject?: number;
  maxTotalStepsPerSubject?: number;
  maxTotalEvidenceBytesPerSubject?: number;
}

/**
 * Default quota configuration (v1 - reasonable defaults)
 */
export const DEFAULT_QUOTA_CONFIG: QuotaConfig = {
  maxStepsPerSession: 50,
  maxTraceEvents: 1000,
  maxEvidenceBytes: 100 * 1024 * 1024, // 100 MB
  maxSessionDurationMs: 30 * 60 * 1000, // 30 minutes
};

/**
 * Quota violation type
 */
export type QuotaViolationType =
  | "max_steps_exceeded"
  | "max_trace_events_exceeded"
  | "max_evidence_bytes_exceeded"
  | "max_session_duration_exceeded"
  | "max_sessions_per_subject_exceeded"
  | "max_total_steps_per_subject_exceeded"
  | "max_total_evidence_bytes_per_subject_exceeded";

/**
 * Quota violation details
 */
export interface QuotaViolation {
  type: QuotaViolationType;
  limit: number;
  actual: number;
  message: string;
}

/**
 * Check if quota is exceeded
 */
export function checkQuotaViolation(
  config: QuotaConfig,
  currentSteps: number,
  currentTraceEvents: number,
  currentEvidenceBytes: number,
  currentDurationMs: number
): QuotaViolation | null {
  if (currentSteps >= config.maxStepsPerSession) {
    return {
      type: "max_steps_exceeded",
      limit: config.maxStepsPerSession,
      actual: currentSteps,
      message: `Maximum steps per session exceeded (${currentSteps}/${config.maxStepsPerSession})`,
    };
  }

  if (currentTraceEvents >= config.maxTraceEvents) {
    return {
      type: "max_trace_events_exceeded",
      limit: config.maxTraceEvents,
      actual: currentTraceEvents,
      message: `Maximum trace events per session exceeded (${currentTraceEvents}/${config.maxTraceEvents})`,
    };
  }

  if (currentEvidenceBytes >= config.maxEvidenceBytes) {
    return {
      type: "max_evidence_bytes_exceeded",
      limit: config.maxEvidenceBytes,
      actual: currentEvidenceBytes,
      message: `Maximum evidence bytes per session exceeded (${currentEvidenceBytes}/${config.maxEvidenceBytes})`,
    };
  }

  if (currentDurationMs >= config.maxSessionDurationMs) {
    return {
      type: "max_session_duration_exceeded",
      limit: config.maxSessionDurationMs,
      actual: currentDurationMs,
      message: `Maximum session duration exceeded (${currentDurationMs}ms/${config.maxSessionDurationMs}ms)`,
    };
  }

  return null;
}
