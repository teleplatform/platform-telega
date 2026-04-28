export type WatchdogState = {
  lastHeartbeat: number;
  lastSuccessfulReply: number;
  lastProviderSuccess: number;
  consecutiveFailures: number;
  lastRecovery: number;
  isDegraded: boolean;
  degradationReason?: string;
  lockStateActive: boolean;
  lockStateSince?: number;
  recoveryCount: number;
  lastLockClear?: number;
};

export type RecoveryLevel = "none" | "soft" | "medium" | "hard";

export interface RecoveryConfig {
  maxSilenceMs: number;
  maxConsecutiveFailures: number;
  cooldownMs: number;
}

export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  maxSilenceMs: 60000,
  maxConsecutiveFailures: 3,
  cooldownMs: 30000,
};