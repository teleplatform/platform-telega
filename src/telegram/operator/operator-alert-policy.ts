import {
  AlertState,
  AlertReceipt,
  AlertPolicyConfig,
  DEFAULT_ALERT_POLICY,
  getAlertStateCurrent,
  setAlertStateCurrent,
  canAlertDueToTraffic,
  writeAlertReceipt,
  getRecentAlertReceipts,
  getAlertCooldownRemainingMs,
  getLastIncomingAgeSec,
  getAlertStateSummary,
  clearAlertState,
} from "./operator-alert-state.js";

export { getAlertStateCurrent, getAlertStateSummary, clearAlertState };
import { collectHomeSnapshot } from "./operator-telemetry.service.js";
import { getRecentReceipts } from "../../runtime/watchdog/decision-receipts.js";
import { getState as getWatchdogState } from "../../runtime/watchdog/watchdog.state.js";

function formatDegradedAlert(
  reason: string,
  provider: string,
  bridge: boolean,
  cdp: boolean,
  lastDecision: string,
  recoveryCount: number,
  lastIncomingAgeSec: number
): string {
  return `🚨 Tele•GPT Alert
Status: ⚠️ DEGRADED
Reason: ${reason}
Provider: ${provider}
Bridge: ${bridge ? "ON" : "OFF"}
CDP: ${cdp ? "connected" : "disconnected"}
Last Decision: ${lastDecision}
Recovery: ${recoveryCount}/5
Last Incoming: ${lastIncomingAgeSec > 0 ? `${Math.floor(lastIncomingAgeSec)}s ago` : "none"}
Action: monitoring / recovery active`;
}

function formatCriticalAlert(
  reason: string,
  provider: string,
  bridge: boolean,
  cdp: boolean,
  lastDecision: string,
  recoveryCount: number,
  lockState: "ACTIVE" | "CLEAR",
  lastIncomingAgeSec: number
): string {
  return `🚨 Tele•GPT Alert
Status: 🔥 CRITICAL
Reason: ${reason}
Provider: ${provider}
Bridge: ${bridge ? "ON" : "OFF"}
CDP: ${cdp ? "connected" : "disconnected"}
Last Decision: ${lastDecision}
Recovery: ${recoveryCount}/5
Lock: ${lockState}
Last Incoming: ${lastIncomingAgeSec > 0 ? `${Math.floor(lastIncomingAgeSec)}s ago` : "none"}
Action: awaiting escalation / operator attention`;
}

function formatLockedAlert(
  provider: string,
  bridge: boolean,
  cdp: boolean,
  lastDecision: string,
  recoveryCount: number,
  lastIncomingAgeSec: number
): string {
  return `🚨 Tele•GPT Alert
Status: ⛔ LOCKED
Reason: Recovery policy limit exceeded
Provider: ${provider}
Bridge: ${bridge ? "ON" : "OFF"}
CDP: ${cdp ? "connected" : "disconnected"}
Last Decision: ${lastDecision}
Recovery: ${recoveryCount}/5
Lock: ACTIVE
Last Incoming: ${lastIncomingAgeSec > 0 ? `${Math.floor(lastIncomingAgeSec)}s ago` : "none"}
Action: operator reset required`;
}

function formatRecoveredAlert(
  provider: string,
  bridge: boolean,
  cdp: boolean,
  lastIncomingAgeSec: number
): string {
  return `✅ Tele•GPT Recovered
Status: HEALTHY
Provider: ${provider}
Bridge: ${bridge ? "ON" : "OFF"}
CDP: ${cdp ? "connected" : "disconnected"}
Last Incoming: ${lastIncomingAgeSec > 0 ? `${Math.floor(lastIncomingAgeSec)}s ago` : "none"}
Action: alert state cleared`;
}

export function evaluateAlertState(): AlertState {
  const snap = collectHomeSnapshot();
  const lastSuccessSec = snap.lastSuccessAgeSec;
  const lockState = snap.lockState;
  
  if (lockState === "ACTIVE") return "LOCKED";
  if (lastSuccessSec >= DEFAULT_ALERT_POLICY.criticalThresholdSec) return "CRITICAL";
  if (lastSuccessSec >= DEFAULT_ALERT_POLICY.degradedThresholdSec) return "DEGRADED";
  return "HEALTHY";
}

export function checkAlertNeeded(): {
  shouldAlert: boolean;
  alertState: AlertState;
  message?: string;
  skipReason?: string;
} {
  const config = DEFAULT_ALERT_POLICY;
  const currentState = getAlertStateCurrent();
  const newState = evaluateAlertState();
  const lastIncomingAge = getLastIncomingAgeSec();
  
  const snap = collectHomeSnapshot();
  const recentDecisions = getRecentReceipts(10);
  const recoveryCount = recentDecisions.filter(r => r.selectedAction !== "NO_OP").length;
  const lastDecision = recentDecisions[0]?.selectedAction || "none";
  
  const provider = snap.providerEffective;
  const bridge = snap.bridgeEnabled;
  const cdp = snap.botServiceStatus === "RUNNING";
  const lockState = snap.lockState;
  
  if (newState === "HEALTHY") {
    if (currentState !== "HEALTHY" && config.enableRecoveredEvent) {
      setAlertStateCurrent("HEALTHY");
      const message = formatRecoveredAlert(provider, bridge, cdp, lastIncomingAge);
      return { shouldAlert: true, alertState: "HEALTHY", message };
    }
    if (currentState !== "HEALTHY") {
      setAlertStateCurrent("HEALTHY");
    }
    return { shouldAlert: false, alertState: "HEALTHY" };
  }
  
  if (newState === "LOCKED" && currentState !== "LOCKED") {
    setAlertStateCurrent("LOCKED");
    const message = formatLockedAlert(provider, bridge, cdp, lastDecision, recoveryCount, lastIncomingAge);
    return { shouldAlert: true, alertState: "LOCKED", message };
  }
  
  if (newState === currentState) {
    const cooldown = getAlertCooldownRemainingMs();
    if (cooldown > 0) {
      return { shouldAlert: false, alertState: newState, skipReason: `cooldown ${Math.floor(cooldown / 1000)}s` };
    }
    return { shouldAlert: false, alertState: newState, skipReason: "duplicate state" };
  }
  
  if (!canAlertDueToTraffic(lastIncomingAge, config)) {
    return { shouldAlert: false, alertState: newState, skipReason: "no incoming traffic" };
  }
  
  let message: string;
  if (newState === "DEGRADED") {
    message = formatDegradedAlert(`No successful replies for ${Math.floor(snap.lastSuccessAgeSec)}s`, provider, bridge, cdp, lastDecision, recoveryCount, lastIncomingAge);
  } else {
    message = formatCriticalAlert(`No successful replies for ${Math.floor(snap.lastSuccessAgeSec / 60)}m+`, provider, bridge, cdp, lastDecision, recoveryCount, lockState, lastIncomingAge);
  }
  
  return { shouldAlert: true, alertState: newState, message };
}

export function recordAlertSent(alertState: AlertState, previousState: string, sent: boolean, reason: string, skipReason?: string): void {
  const snap = collectHomeSnapshot();
  const recentDecisions = getRecentReceipts(10);
  const recoveryCount = recentDecisions.filter(r => r.selectedAction !== "NO_OP").length;
  const lastDecision = recentDecisions[0]?.selectedAction || "none";
  
  const receipt: AlertReceipt = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    alertState,
    previousState,
    reason,
    sent,
    skipReason,
    lastDecision,
    recoveryCount,
    lockState: snap.lockState,
    provider: snap.providerEffective,
    transport: "cdp",
    cdpConnected: snap.botServiceStatus === "RUNNING",
    lastIncomingAgeSec: getLastIncomingAgeSec(),
  };
  
  writeAlertReceipt(receipt);
}

export function forceAlertRecheck(): { alertState: AlertState; message?: string } {
  return checkAlertNeeded();
}

export function resetAlertState(): void {
  setAlertStateCurrent("HEALTHY");
}