export type TelemetryScreen =
  | "HOME"
  | "HEALTH"
  | "RECOVERY"
  | "RUNTIME"
  | "ACTIONS";

export interface TelemetryNavState {
  currentScreen: TelemetryScreen;
  messageId: number | null;
  chatId: number;
}

export interface HomeSnapshot {
  botServiceStatus: "RUNNING" | "DEGRADED" | "STOPPED" | "UNKNOWN" | "CRITICAL";
  watchdogStatus: "RUNNING" | "DEGRADED" | "STOPPED" | "UNKNOWN" | "CRITICAL";
  providerEffective: string;
  bridgeEnabled: boolean;
  lockState: "ACTIVE" | "CLEAR";
  lastSuccessAgeSec: number;
  lastDecision: string;
  lastCritical: string;
  counters: {
    success: number;
    blocked: number;
    error: number;
  };
}

export interface HealthSnapshot {
  windowMs: number;
  total: number;
  success: number;
  blocked: number;
  error: number;
  fallback: number;
  successRate: string;
  blockedRate: string;
  errorRate: string;
  providerStats: Record<string, { success: number; error: number }>;
  trend: "↑ improving" | "→ stable" | "↓ degrading" | "? unknown";
}

export interface RecoverySnapshot {
  recentReceipts: Array<{
    timestamp: number;
    degradationClass: string;
    selectedAction: string;
    reason: string;
    precedence: string;
    confidence: number;
  }>;
  recoveryCountInWindow: number;
  maxRecoveriesPerWindow: number;
  windowMs: number;
  isLocked: boolean;
}

export interface RuntimeSnapshot {
  bridgeEnabled: boolean;
  forcedProvider: string | null;
  effectiveProvider: string;
  transport: string;
  cdpConnected: boolean;
  cdpEndpoint: string | null;
  lastProviderSuccess: number;
  lastProviderError: string | null;
  uptimeSec: number;
}

export interface CriticalEvent {
  timestamp: number;
  level: "ERROR" | "WARN" | "CRITICAL";
  message: string;
  reason?: string;
}

export interface OperatorAction {
  id: string;
  label: string;
  action: "operator_reset" | "soft_recover" | "restart_watchdog" | "refresh" | "navigate";
  value?: string;
  dangerous?: boolean;
}
