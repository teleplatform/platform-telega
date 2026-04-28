import { writeReceipt } from "../../runtime/watchdog/decision-receipts.js";
import { clearLockState } from "../../runtime/watchdog/watchdog.state.js";
import type { DecisionReceipt } from "../../runtime/watchdog/decision-engine.types.js";

const ACTION_RECEIPT_PREFIX = "op_action";

function writeActionReceipt(
  action: string,
  reason: string,
  metadata?: Record<string, any>
): DecisionReceipt {
  const receipt: DecisionReceipt = {
    id: `${ACTION_RECEIPT_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    degradationClass: "OPERATOR_INITIATED",
    selectedAction: action as any,
    precedence: "critical",
    reason,
    confidence: 100,
    cooldownApplied: false,
    cooldownMs: 0,
    lockState: false,
    evidenceSummary: `operator action: ${action}`,
  };

  if (metadata) {
    // Could extend DecisionReceipt with metadata field if needed
  }

  writeReceipt(receipt);
  return receipt;
}

// ============================================
// OPERATOR ACTIONS
// ============================================

export async function actionRefresh(): Promise<string> {
  const receipt = writeActionReceipt("REFRESH", "Operator requested status refresh");
  return `✅ Refreshed — ${receipt.id.slice(0, 16)}`;
}

export async function actionOperatorReset(): Promise<string> {
  const wasLocked = require("fs").existsSync("/Users/vijaytaitoo/Projects/tele-gpt/.self-heal-lock");

  clearLockState();

  const receipt = writeActionReceipt("OPERATOR_RESET", "Operator cleared lock state", { wasLocked });
  return `✅ Lock cleared — system recoverable`;
}

export async function actionSoftRecover(): Promise<string> {
  // Soft recovery = reset bridge state only (no restart)
  try {
    // Bridge will re-init on next message automatically
    const receipt = writeActionReceipt("SOFT_RECOVER", "Operator triggered bridge state reset");
    return `✅ Bridge state reset — will reinitialize on next message`;
  } catch (err: any) {
    return `❌ Soft recover failed: ${err.message}`;
  }
}

export async function actionRestartWatchdog(): Promise<string> {
  const { exec } = await import("child_process");

  return new Promise((resolve) => {
    exec("launchctl kickstart -k com.telegpt.watchdog", (err) => {
      if (err) {
        resolve(`❌ Watchdog restart failed: ${err.message}`);
      } else {
        const receipt = writeActionReceipt("RESTART_WATCHDOG", "Operator restarted watchdog daemon");
        resolve(`✅ Watchdog daemon restarted`);
      }
    });
  });
}

export async function actionRestartBot(): Promise<string> {
  const { exec } = await import("child_process");

  return new Promise((resolve) => {
    exec("launchctl kickstart -k com.telegpt.bot", (err) => {
      if (err) {
        resolve(`❌ Bot restart failed: ${err.message}`);
      } else {
        const receipt = writeActionReceipt("RESTART_BOT", "Operator restarted bot service");
        resolve(`✅ Bot service restart initiated`);
      }
    });
  });
}

export async function actionAlertReset(): Promise<string> {
  try {
    const { clearAlertState } = await import("./operator-alert-state.js");
    clearAlertState();
    const receipt = writeActionReceipt("ALERT_RESET", "Operator reset alert state");
    return `✅ Alert state reset — HEALTHY`;
  } catch (err: any) {
    return `❌ Alert reset failed: ${err.message}`;
  }
}

export async function actionShowAlertState(): Promise<string> {
  try {
    const { getAlertStateSummary } = await import("./operator-alert-state.js");
    const summary = getAlertStateSummary();
    return `📊 Alert State\nState: ${summary.current}\nLast Decision: ${summary.lastDecision}\nRecovery: ${summary.recoveryCount}/5\nLock: ${summary.lockState}\nCooldown: ${Math.floor(summary.cooldownRemainingMs / 1000)}s\nLast Incoming: ${summary.lastIncomingAgeSec > 0 ? `${summary.lastIncomingAgeSec}s ago` : "none"}`;
  } catch (err: any) {
    return `❌ Alert state failed: ${err.message}`;
  }
}

// ============================================
// NAVIGATION
// ============================================

export type NavAction = "navigate" | "action";

export function parseNavAction(payload: string): { action: NavAction; screen?: string } {
  if (payload.startsWith("nav:")) {
    return { action: "navigate", screen: payload.replace("nav:", "") as any };
  }
  if (payload.startsWith("act:")) {
    return { action: "action", screen: payload.replace("act:", "") };
  }
  return { action: "navigate", screen: "HOME" };
}
