export type AlertState = "HEALTHY" | "DEGRADED" | "CRITICAL" | "LOCKED";

export interface AlertReceipt {
  id: string;
  timestamp: number;
  alertState: AlertState;
  previousState: string;
  reason: string;
  sent: boolean;
  skipReason?: string;
  lastDecision: string;
  recoveryCount: number;
  lockState: "ACTIVE" | "CLEAR";
  provider: string;
  transport: string;
  cdpConnected: boolean;
  lastIncomingAgeSec: number;
}

export interface AlertPolicyConfig {
  degradedThresholdSec: number;
  criticalThresholdSec: number;
  cooldownMs: number;
  noTrafficGraceSec: number;
  enableRecoveredEvent: boolean;
}

export const DEFAULT_ALERT_POLICY: AlertPolicyConfig = {
  degradedThresholdSec: 120,
  criticalThresholdSec: 300,
  cooldownMs: 300000,
  noTrafficGraceSec: 60,
  enableRecoveredEvent: true,
};

const ALERT_STATE_FILE = ".alert-state";
const ALERT_RECEIPTS_FILE = ".alert-receipts";
const LAST_INCOMING_FILE = ".last-incoming";

export function getAlertStateCurrent(): AlertState {
  const fs = require("fs");
  try {
    const content = fs.readFileSync(ALERT_STATE_FILE, "utf-8").trim();
    const data = JSON.parse(content);
    return data.current as AlertState;
  } catch {
    return "HEALTHY";
  }
}

export function setAlertStateCurrent(state: AlertState): void {
  const fs = require("fs");
  const data = { current: state, updatedAt: Date.now() };
  fs.writeFileSync(ALERT_STATE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function getLastIncomingTimestamp(): number {
  const fs = require("fs");
  try {
    const content = fs.readFileSync(LAST_INCOMING_FILE, "utf-8").trim();
    const data = JSON.parse(content);
    return data.timestamp || 0;
  } catch {
    return 0;
  }
}

export function setLastIncomingTimestamp(timestamp: number, chatId: number, type: string): void {
  const fs = require("fs");
  const data = { timestamp, chatId, type };
  fs.writeFileSync(LAST_INCOMING_FILE, JSON.stringify(data), "utf-8");
}

export function getLastIncomingAgeSec(): number {
  const ts = getLastIncomingTimestamp();
  if (ts === 0) return -1;
  return Math.floor((Date.now() - ts) / 1000);
}

export function canAlertDueToTraffic(secondsAgo: number, config: AlertPolicyConfig): boolean {
  const lastIncoming = getLastIncomingAgeSec();
  if (lastIncoming < 0) return true;
  return lastIncoming < config.noTrafficGraceSec * 3;
}

export function writeAlertReceipt(receipt: AlertReceipt): void {
  const fs = require("fs");
  const line = JSON.stringify(receipt) + "\n";
  fs.appendFileSync(ALERT_RECEIPTS_FILE, line, "utf-8");
}

export function getRecentAlertReceipts(count = 10): AlertReceipt[] {
  const fs = require("fs");
  try {
    const content = fs.readFileSync(ALERT_RECEIPTS_FILE, "utf-8").trim();
    const lines = content.split("\n").filter(Boolean);
    return lines.slice(-count).map((line: string) => JSON.parse(line) as AlertReceipt);
  } catch {
    return [];
  }
}

export function getLastAlertReceipt(): AlertReceipt | null {
  const receipts = getRecentAlertReceipts(1);
  return receipts[0] || null;
}

export function getAlertCooldownRemainingMs(): number {
  const lastReceipt = getLastAlertReceipt();
  if (!lastReceipt || !lastReceipt.sent) return 0;
  const elapsed = Date.now() - lastReceipt.timestamp;
  const remaining = DEFAULT_ALERT_POLICY.cooldownMs - elapsed;
  return Math.max(0, remaining);
}

export function resetAlertState(): void {
  setAlertStateCurrent("HEALTHY");
}

export function clearAlertState(): void {
  setAlertStateCurrent("HEALTHY");
}

export function getAlertStateSummary(): {
  current: AlertState;
  lastDecision: string;
  recoveryCount: number;
  lockState: "ACTIVE" | "CLEAR";
  cooldownRemainingMs: number;
  lastAlertAt: number | null;
  lastIncomingAgeSec: number;
} {
  const state = getAlertStateCurrent();
  const lastReceipt = getLastAlertReceipt();
  const cooldown = getAlertCooldownRemainingMs();
  const lastIncoming = getLastIncomingAgeSec();
  
  const { getRecentReceipts } = require("../../runtime/watchdog/decision-receipts.js");
  const { getState } = require("../../runtime/watchdog/watchdog.state.js");
  const { collectHomeSnapshot } = require("./operator-telemetry.service.js");
  
  const recentRec = getRecentReceipts(10);
  const watchdogState = getState();
  const snap = collectHomeSnapshot();
  
  return {
    current: state,
    lastDecision: recentRec[0]?.selectedAction || "none",
    recoveryCount: recentRec.filter((r: any) => r.selectedAction !== "NO_OP").length,
    lockState: snap.lockState,
    cooldownRemainingMs: cooldown,
    lastAlertAt: lastReceipt?.timestamp || null,
    lastIncomingAgeSec: lastIncoming,
  };
}