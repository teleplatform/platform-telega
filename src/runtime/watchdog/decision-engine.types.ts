export type DegradationClass =
  | "HEALTHY"
  | "BRIDGE_STALE"
  | "CDP_UNAVAILABLE"
  | "EMPTY_OUTPUT_SPIKE"
  | "ECHO_REPLY_SPIKE"
  | "DELIVERY_ERROR_SPIKE"
  | "BOT_ALIVE_BUT_NO_SUCCESS"
  | "WATCHDOG_LOOP_RISK"
  | "OPERATOR_INITIATED";

export type RecoveryAction =
  | "NO_OP"
  | "RESET_BRIDGE_STATE"
  | "RECONNECT_CDP"
  | "RESTART_BRIDGE_LAYER"
  | "RESTART_BOT_SERVICE"
  | "ENTER_LOCK_STATE"
  | "REQUIRE_OPERATOR_RESET";

export type ActionPrecedence = "low" | "medium" | "high" | "critical";

export interface DegradationSignal {
  class: DegradationClass;
  severity: number; // 0-100
  reason: string;
  evidence: string[];
  windowMs: number;
}

export interface DecisionContext {
  degradation: DegradationSignal;
  currentState: {
    consecutiveFailures: number;
    lastRecovery: number;
    isDegraded: boolean;
    lockState: boolean;
    recoveryCount: number;
  };
  evidenceWindow: number;
}

export interface RecoveryDecision {
  action: RecoveryAction;
  precedence: ActionPrecedence;
  reason: string;
  cooldownApplied: boolean;
  cooldownMs: number;
  lockState: boolean;
  receiptId: string;
  confidence: number; // 0-100
}

export interface DecisionReceipt {
  id: string;
  timestamp: number;
  degradationClass: DegradationClass;
  selectedAction: RecoveryAction;
  precedence: ActionPrecedence;
  reason: string;
  confidence: number;
  cooldownApplied: boolean;
  cooldownMs: number;
  lockState: boolean;
  evidenceSummary: string;
  traceId?: string;
}

export interface RecoveryPolicy {
  maxRecoveriesPerWindow: number;
  recoveryWindowMs: number;
  escalationStepMs: number;
  lockStateThreshold: number;
  operatorResetCommand: string;
}

export const DEFAULT_RECOVERY_POLICY: RecoveryPolicy = {
  maxRecoveriesPerWindow: 5,
  recoveryWindowMs: 300000, // 5 minutes
  escalationStepMs: 60000, // 1 minute between escalations
  lockStateThreshold: 3, // 3 failed recoveries → lock
  operatorResetCommand: "operator_reset",
};

export const ACTION_COOLDOWN: Record<RecoveryAction, number> = {
  NO_OP: 0,
  RESET_BRIDGE_STATE: 10000,
  RECONNECT_CDP: 15000,
  RESTART_BRIDGE_LAYER: 30000,
  RESTART_BOT_SERVICE: 60000,
  ENTER_LOCK_STATE: 0,
  REQUIRE_OPERATOR_RESET: 0,
};
