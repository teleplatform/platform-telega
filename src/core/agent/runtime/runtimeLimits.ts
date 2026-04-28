type Quotas = {
  maxTraceEventsPerSession: number;
};

type RateLimits = {
  agentRunPerMin: number;
  statusPerMin: number;
  verifyPerMin: number;
  maxActiveStreams: number;
};

export type RuntimeLimits = {
  max_session_duration_ms: number;
  max_steps_per_session: number;
  max_net_fetch_calls_per_session: number;
  max_fs_read_calls_per_session: number;
  quotas: Quotas;
  rate: RateLimits;
};

export const DEFAULT_LIMITS: RuntimeLimits = {
  max_session_duration_ms: 300000, // 5 minutes
  max_steps_per_session: 10,
  max_net_fetch_calls_per_session: 10,
  max_fs_read_calls_per_session: 20,
  quotas: {
    maxTraceEventsPerSession: 1000,
  },
  rate: {
    agentRunPerMin: 5,
    statusPerMin: 60,
    verifyPerMin: 30,
    maxActiveStreams: 5,
  },
};