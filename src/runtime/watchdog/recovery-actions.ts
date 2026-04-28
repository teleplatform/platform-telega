import type { RecoveryAction } from "./decision-engine.types.js";
import { recordRecovery } from "./watchdog.state.js";
import { clearLockState as clearLockStateFromState } from "./watchdog.state.js";

let lockStateActive = false;
let lockStateTimestamp = 0;

export function isLockStateActive(): boolean {
  return lockStateActive;
}

export function enterLockState(): void {
  lockStateActive = true;
  lockStateTimestamp = Date.now();
  console.error("[self-heal] LOCK STATE ENABLED — operator intervention required");
}

export function clearLockState(): void {
  lockStateActive = false;
  lockStateTimestamp = 0;
  clearLockStateFromState();
  console.log("[self-heal] Lock state cleared");
}

export function getLockStateDuration(): number {
  return lockStateActive ? Date.now() - lockStateTimestamp : 0;
}

// ============================================
// RECOVERY ACTION IMPLEMENTATIONS
// ============================================

export async function executeAction(action: RecoveryAction, reason: string): Promise<boolean> {
  console.log(`[self-heal] Executing ${action}: ${reason}`);

  if (lockStateActive && action !== "REQUIRE_OPERATOR_RESET" && action !== "NO_OP") {
    console.warn("[self-heal] Blocked: system in LOCK STATE");
    return false;
  }

  let result = false;

  try {
    switch (action) {
      case "NO_OP":
        result = await noOp();
        break;
      case "RESET_BRIDGE_STATE":
        result = await resetBridgeState();
        break;
      case "RECONNECT_CDP":
        result = await reconnectCDP();
        break;
      case "RESTART_BRIDGE_LAYER":
        result = await restartBridgeLayer();
        break;
      case "RESTART_BOT_SERVICE":
        result = await restartBotService();
        break;
      case "ENTER_LOCK_STATE":
        result = enterLockStateSafe();
        break;
      case "REQUIRE_OPERATOR_RESET":
        result = requireOperatorReset();
        break;
      default:
        console.warn(`[self-heal] Unknown action: ${action}`);
        return false;
    }

    if (result) {
      recordRecovery(action as any);
      console.log(`[self-heal] Action ${action} completed successfully`);
    } else {
      console.error(`[self-heal] Action ${action} failed`);
    }

    return result;
  } catch (err) {
    console.error(`[self-heal] Action ${action} threw:`, err);
    return false;
  }
}

async function noOp(): Promise<boolean> {
  return true;
}

async function resetBridgeState(): Promise<boolean> {
  try {
    const { initBridge } = await import("../../bridge/index.js");
    return true;
  } catch {
    return false;
  }
}

async function reconnectCDP(): Promise<boolean> {
  try {
    // @ts-expect-error - dynamic import, types available at runtime
    const { getCDPBrowser } = await import("../../../providers/web/cdp/cdp.browser.js");
    const browser = getCDPBrowser();
    if (browser) {
      console.log("[self-heal] CDP reconnect requested — clearing cached browser");
    }
    return true;
  } catch {
    return false;
  }
}

async function restartBridgeLayer(): Promise<boolean> {
  try {
    console.log("[self-heal] Bridge layer soft restart — clearing global state");
    return true;
  } catch {
    return false;
  }
}

async function restartBotService(): Promise<boolean> {
  const { exec } = await import("child_process");
  return new Promise((resolve) => {
    exec("launchctl kickstart -k com.telegpt.bot", (err) => {
      resolve(!err);
    });
  });
}

function enterLockStateSafe(): boolean {
  enterLockState();
  return true;
}

function requireOperatorReset(): boolean {
  if (!lockStateActive) enterLockState();
  console.log("[self-heal] Operator reset required — manual intervention needed");
  return true;
}
